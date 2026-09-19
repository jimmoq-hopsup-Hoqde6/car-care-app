import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const dataDir = process.env.DATA_DIR ?? resolve(process.cwd(), "data");
const dbPath = process.env.DB_PATH ?? resolve(dataDir, "car-care.sqlite");

mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS vehicles (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname   TEXT    NOT NULL,
    make       TEXT    NOT NULL,
    model      TEXT    NOT NULL,
    year       INTEGER NOT NULL,
    mileage    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS services (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id  INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    type        TEXT    NOT NULL,
    performed_on TEXT   NOT NULL,
    mileage     INTEGER NOT NULL DEFAULT 0,
    cost        REAL    NOT NULL DEFAULT 0,
    notes       TEXT    NOT NULL DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Insert a small amount of realistic sample data the first time the app runs
 * so the dashboard is not empty on a fresh environment. Dates are relative to
 * "now" so the seeded reminders always show a realistic mix of statuses
 * (on track, due soon, and overdue).
 */
export function seedIfEmpty(): void {
  const { count } = db.prepare("SELECT COUNT(*) AS count FROM vehicles").get() as {
    count: number;
  };
  if (count > 0) return;

  const insertVehicle = db.prepare(
    `INSERT INTO vehicles (nickname, make, model, year, mileage)
     VALUES (@nickname, @make, @model, @year, @mileage)`
  );
  const insertService = db.prepare(
    `INSERT INTO services (vehicle_id, type, performed_on, mileage, cost, notes)
     VALUES (@vehicle_id, @type, @performed_on, @mileage, @cost, @notes)`
  );

  const seed = db.transaction(() => {
    const daily = insertVehicle.run({
      nickname: "Daily Driver",
      make: "Toyota",
      model: "Corolla",
      year: 2019,
      mileage: 62450,
    });
    const weekend = insertVehicle.run({
      nickname: "Weekend Truck",
      make: "Ford",
      model: "F-150",
      year: 2016,
      mileage: 98120,
    });

    // Recent oil change -> "On track".
    insertService.run({
      vehicle_id: daily.lastInsertRowid,
      type: "Oil Change",
      performed_on: daysAgo(45),
      mileage: 61900,
      cost: 64.99,
      notes: "Full synthetic 0W-20.",
    });
    // Tire rotation close to its mileage interval -> "Due soon".
    insertService.run({
      vehicle_id: daily.lastInsertRowid,
      type: "Tire Rotation",
      performed_on: daysAgo(60),
      mileage: 55300,
      cost: 25,
      notes: "Rotated and balanced.",
    });
    // (Air Filter and Brake Pads have no record -> "Overdue".)

    insertService.run({
      vehicle_id: weekend.lastInsertRowid,
      type: "Oil Change",
      performed_on: daysAgo(20),
      mileage: 97800,
      cost: 79.5,
      notes: "Diesel oil + filter.",
    });
    insertService.run({
      vehicle_id: weekend.lastInsertRowid,
      type: "Brake Pads",
      performed_on: daysAgo(30),
      mileage: 97000,
      cost: 240.5,
      notes: "Front pads and rotors replaced.",
    });
  });

  seed();
}
