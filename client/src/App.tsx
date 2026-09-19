import { useEffect, useState } from "react";
import { api } from "./api";
import { AddVehicleForm } from "./components/AddVehicleForm";
import { VehicleDetail } from "./components/VehicleDetail";
import type { NewVehicle, Vehicle } from "./types";

export default function App() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadVehicles(selectFirst = false) {
    try {
      const list = await api.listVehicles();
      setVehicles(list);
      setError(null);
      if (selectFirst && list.length > 0 && selectedId === null) {
        setSelectedId(list[0].id);
      }
      if (list.length === 0) setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadVehicles(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addVehicle(data: NewVehicle) {
    const created = await api.createVehicle(data);
    await loadVehicles();
    setSelectedId(created.id);
  }

  async function deleteVehicle(id: number) {
    await api.deleteVehicle(id);
    if (selectedId === id) setSelectedId(null);
    await loadVehicles(true);
  }

  const selected = vehicles.find((v) => v.id === selectedId) ?? null;

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:flex-row">
        <aside className="w-full shrink-0 space-y-4 lg:w-80">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🚗</span>
            <div>
              <h1 className="text-xl font-bold text-white">Car Care</h1>
              <p className="text-xs text-slate-400">Maintenance tracker</p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-300 ring-1 ring-rose-500/40">
              {error}
            </div>
          )}

          <div className="space-y-2">
            {vehicles.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedId(v.id)}
                className={`group flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                  v.id === selectedId
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-slate-700 bg-slate-800/40 hover:border-slate-500"
                }`}
              >
                <span>
                  <span className="block font-medium text-slate-100">
                    {v.nickname}
                  </span>
                  <span className="block text-xs text-slate-400">
                    {v.year} {v.make} {v.model}
                  </span>
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteVehicle(v.id);
                  }}
                  className="text-xs text-slate-600 opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
                  role="button"
                  aria-label={`Delete ${v.nickname}`}
                >
                  ✕
                </span>
              </button>
            ))}
          </div>

          <AddVehicleForm onAdd={addVehicle} />
        </aside>

        <main className="min-w-0 flex-1 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          {loading ? (
            <p className="text-slate-500">Loading…</p>
          ) : selected ? (
            <VehicleDetail
              key={selected.id}
              vehicle={selected}
              onChanged={() => void loadVehicles()}
            />
          ) : (
            <div className="flex h-full min-h-64 flex-col items-center justify-center text-center text-slate-500">
              <span className="text-5xl">🔧</span>
              <p className="mt-3 text-lg font-medium text-slate-300">
                No vehicle selected
              </p>
              <p className="text-sm">
                Add a vehicle to start tracking its maintenance.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
