import { useState, type FormEvent } from "react";
import type { NewVehicle } from "../types";

interface Props {
  onAdd: (vehicle: NewVehicle) => Promise<void>;
}

const empty: NewVehicle = {
  nickname: "",
  make: "",
  model: "",
  year: new Date().getFullYear(),
  mileage: 0,
};

export function AddVehicleForm({ onAdd }: Props) {
  const [form, setForm] = useState<NewVehicle>(empty);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.nickname || !form.make || !form.model) return;
    setSaving(true);
    try {
      await onAdd(form);
      setForm(empty);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-slate-600 py-3 text-sm font-medium text-slate-300 transition hover:border-cyan-400 hover:text-cyan-300"
      >
        + Add a vehicle
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border border-slate-700 bg-slate-800/60 p-4"
    >
      <input
        autoFocus
        placeholder="Nickname (e.g. Daily Driver)"
        value={form.nickname}
        onChange={(e) => setForm({ ...form, nickname: e.target.value })}
        className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-cyan-500"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          placeholder="Make"
          value={form.make}
          onChange={(e) => setForm({ ...form, make: e.target.value })}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-cyan-500"
        />
        <input
          placeholder="Model"
          value={form.model}
          onChange={(e) => setForm({ ...form, model: e.target.value })}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-cyan-500"
        />
        <input
          type="number"
          placeholder="Year"
          value={form.year}
          onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
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
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-cyan-500 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save vehicle"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-slate-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
