import cors from "cors";
import express, { type Request, type Response } from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { db, seedIfEmpty } from "./db.js";
import { computeReminders, type ServiceRow } from "./reminders.js";

seedIfEmpty();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT ?? 3001);

interface VehicleRow {
  id: number;
  nickname: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  created_at: string;
}

function getVehicle(id: number): VehicleRow | undefined {
  return db.prepare("SELECT * FROM vehicles WHERE id = ?").get(id) as
    | VehicleRow
    | undefined;
}

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/api/vehicles", (_req: Request, res: Response) => {
  const vehicles = db
    .prepare("SELECT * FROM vehicles ORDER BY created_at DESC, id DESC")
    .all() as VehicleRow[];
  res.json(vehicles);
});

app.post("/api/vehicles", (req: Request, res: Response) => {
  const { nickname, make, model, year, mileage } = req.body ?? {};
  if (!nickname || !make || !model || !year) {
    return res
      .status(400)
      .json({ error: "nickname, make, model and year are required" });
  }
  const info = db
    .prepare(
      `INSERT INTO vehicles (nickname, make, model, year, mileage)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      String(nickname),
      String(make),
      String(model),
      Number(year),
      Number(mileage ?? 0)
    );
  res.status(201).json(getVehicle(Number(info.lastInsertRowid)));
});

app.get("/api/vehicles/:id", (req: Request, res: Response) => {
  const vehicle = getVehicle(Number(req.params.id));
  if (!vehicle) return res.status(404).json({ error: "vehicle not found" });
  res.json(vehicle);
});

app.put("/api/vehicles/:id", (req: Request, res: Response) => {
  const vehicle = getVehicle(Number(req.params.id));
  if (!vehicle) return res.status(404).json({ error: "vehicle not found" });
  const { nickname, make, model, year, mileage } = req.body ?? {};
  db.prepare(
    `UPDATE vehicles
     SET nickname = ?, make = ?, model = ?, year = ?, mileage = ?
     WHERE id = ?`
  ).run(
    String(nickname ?? vehicle.nickname),
    String(make ?? vehicle.make),
    String(model ?? vehicle.model),
    Number(year ?? vehicle.year),
    Number(mileage ?? vehicle.mileage),
    vehicle.id
  );
  res.json(getVehicle(vehicle.id));
});

app.delete("/api/vehicles/:id", (req: Request, res: Response) => {
  const info = db
    .prepare("DELETE FROM vehicles WHERE id = ?")
    .run(Number(req.params.id));
  if (info.changes === 0)
    return res.status(404).json({ error: "vehicle not found" });
  res.status(204).end();
});

app.get("/api/vehicles/:id/services", (req: Request, res: Response) => {
  const vehicle = getVehicle(Number(req.params.id));
  if (!vehicle) return res.status(404).json({ error: "vehicle not found" });
  const services = db
    .prepare(
      "SELECT * FROM services WHERE vehicle_id = ? ORDER BY performed_on DESC, id DESC"
    )
    .all(vehicle.id) as ServiceRow[];
  res.json(services);
});

app.post("/api/vehicles/:id/services", (req: Request, res: Response) => {
  const vehicle = getVehicle(Number(req.params.id));
  if (!vehicle) return res.status(404).json({ error: "vehicle not found" });
  const { type, performedOn, mileage, cost, notes } = req.body ?? {};
  if (!type || !performedOn) {
    return res
      .status(400)
      .json({ error: "type and performedOn are required" });
  }
  const info = db
    .prepare(
      `INSERT INTO services (vehicle_id, type, performed_on, mileage, cost, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      vehicle.id,
      String(type),
      String(performedOn),
      Number(mileage ?? 0),
      Number(cost ?? 0),
      String(notes ?? "")
    );

  // Keep the vehicle's odometer in sync when a newer service reports more miles.
  if (Number(mileage ?? 0) > vehicle.mileage) {
    db.prepare("UPDATE vehicles SET mileage = ? WHERE id = ?").run(
      Number(mileage),
      vehicle.id
    );
  }

  const created = db
    .prepare("SELECT * FROM services WHERE id = ?")
    .get(Number(info.lastInsertRowid));
  res.status(201).json(created);
});

app.delete("/api/services/:id", (req: Request, res: Response) => {
  const info = db
    .prepare("DELETE FROM services WHERE id = ?")
    .run(Number(req.params.id));
  if (info.changes === 0)
    return res.status(404).json({ error: "service not found" });
  res.status(204).end();
});

app.get("/api/vehicles/:id/reminders", (req: Request, res: Response) => {
  const vehicle = getVehicle(Number(req.params.id));
  if (!vehicle) return res.status(404).json({ error: "vehicle not found" });
  const services = db
    .prepare("SELECT * FROM services WHERE vehicle_id = ?")
    .all(vehicle.id) as ServiceRow[];
  res.json(computeReminders(vehicle.mileage, services));
});

// In production, serve the built client so the whole app runs from one process.
const clientDist = resolve(process.cwd(), "../client/dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(resolve(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`[server] Car Care API listening on http://localhost:${PORT}`);
});
