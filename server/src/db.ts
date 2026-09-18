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

/**
 * Insert a small amount of realistic sample data the first time the app runs
 * so the dashboard is not empty on a fresh environment.
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

    insertService.run({
      vehicle_id: daily.lastInsertRowid,
      type: "Oil Change",
      performed_on: "2025-11-02",
      mileage: 57800,
      cost: 64.99,
      notes: "Full synthetic 0W-20.",
    });
    insertService.run({
      vehicle_id: daily.lastInsertRowid,
      type: "Tire Rotation",
      performed_on: "2026-02-15",
      mileage: 61200,
      cost: 25,
      notes: "Rotated and balanced.",
    });
    insertService.run({
      vehicle_id: weekend.lastInsertRowid,
      type: "Brake Pads",
      performed_on: "2025-08-20",
      mileage: 94000,
      cost: 240.5,
      notes: "Front pads and rotors replaced.",
    });
  });

  seed();
}
