import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { NewService, Reminder, Service, Vehicle } from "../types";

interface Props {
  vehicle: Vehicle;
  onChanged: () => void;
}

const SERVICE_TYPES = [
  "Oil Change",
  "Tire Rotation",
  "Air Filter",
  "Brake Pads",
  "Battery",
  "Inspection",
  "Other",
];

const statusStyles: Record<Reminder["status"], string> = {
  overdue: "bg-rose-500/15 text-rose-300 ring-rose-500/40",
  "due-soon": "bg-amber-500/15 text-amber-300 ring-amber-500/40",
  ok: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
};

const statusLabel: Record<Reminder["status"], string> = {
  overdue: "Overdue",
  "due-soon": "Due soon",
  ok: "On track",
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function VehicleDetail({ vehicle, onChanged }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<NewService>({
    type: SERVICE_TYPES[0],
    performedOn: new Date().toISOString().slice(0, 10),
    mileage: vehicle.mileage,
    cost: 0,
    notes: "",
  });

  async function load() {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        api.listServices(vehicle.id),
        api.listReminders(vehicle.id),
      ]);
      setServices(s);
      setReminders(r);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    setForm((f) => ({ ...f, mileage: vehicle.mileage }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id, vehicle.mileage]);

  async function addService(e: FormEvent) {
    e.preventDefault();
    await api.createService(vehicle.id, form);
    setForm({ ...form, cost: 0, notes: "" });
    await load();
    onChanged();
  }

  async function removeService(id: number) {
    await api.deleteService(id);
    await load();
    onChanged();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">{vehicle.nickname}</h2>
          <p className="text-slate-400">
            {vehicle.year} {vehicle.make} {vehicle.model} ·{" "}
            {vehicle.mileage.toLocaleString()} mi
          </p>
        </div>
      </header>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Maintenance reminders
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {reminders.map((r) => (
            <div
              key={r.type}
              className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-100">{r.type}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${statusStyles[r.status]}`}
                >
                  {statusLabel[r.status]}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                {r.milesRemaining > 0
                  ? `${r.milesRemaining.toLocaleString()} mi until due (at ${r.dueAtMileage.toLocaleString()} mi)`
                  : `${Math.abs(r.milesRemaining).toLocaleString()} mi past due`}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {r.lastPerformedOn
                  ? `Last done ${r.lastPerformedOn} @ ${r.lastMileage?.toLocaleString()} mi`
                  : "No record yet"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Log a service
        </h3>
        <form
          onSubmit={addService}
          className="grid gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-4 sm:grid-cols-2"
        >
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-cyan-500"
          >
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={form.performedOn}
            onChange={(e) => setForm({ ...form, performedOn: e.target.value })}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-cyan-500"
          />
          <input
            type="number"
            placeholder="Mileage"
            value={form.mileage}
            onChange={(e) =>
              setForm({ ...form, mileage: Number(e.target.value) })
            }
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-cyan-500"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Cost (USD)"
            value={form.cost}
            onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-cyan-500"
          />
          <input
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="sm:col-span-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-cyan-500"
          />
          <button
            type="submit"
            className="sm:col-span-2 rounded-lg bg-cyan-500 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Add service record
          </button>
        </form>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Service history
        </h3>
        {loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : services.length === 0 ? (
          <p className="text-slate-500">No service records yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-700">
            {services.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-4 bg-slate-800/40 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-slate-100">{s.type}</p>
                  <p className="text-sm text-slate-400">
                    {s.performed_on} · {s.mileage.toLocaleString()} mi ·{" "}
                    {currency.format(s.cost)}
                  </p>
                  {s.notes && (
                    <p className="mt-1 text-sm text-slate-500">{s.notes}</p>
                  )}
                </div>
                <button
                  onClick={() => removeService(s.id)}
                  className="text-xs text-slate-500 transition hover:text-rose-400"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
