"use client";

import { useMemo, useState } from "react";
import type { Job } from "@prisma/client";
import { bookSlotAction } from "@/app/actions/booking";
import type { TimeSlot } from "@/lib/slots";

export function BookingPicker({
  job,
  slots,
  eventTitle,
}: {
  job: Job;
  slots: TimeSlot[];
  eventTitle: string;
}) {
  const [selected, setSelected] = useState<TimeSlot | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, TimeSlot[]>();
    for (const slot of slots) {
      const list = map.get(slot.dayLabel) ?? [];
      list.push(slot);
      map.set(slot.dayLabel, list);
    }
    return [...map.entries()];
  }, [slots]);

  async function confirm() {
    if (!selected) return;
    setBusy(true);
    const result = await bookSlotAction({
      jobId: job.id,
      startIso: selected.startIso,
      endIso: selected.endIso,
    });
    setMessage(result.message);
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-card p-4">
        <p className="text-sm text-stone-600">Calendar title</p>
        <p className="font-semibold text-ink">{eventTitle}</p>
        <p className="mt-1 text-sm text-stone-600">
          {job.address || job.suburb || "Add an address on the job"}
        </p>
      </div>

      <div className="space-y-4">
        {grouped.map(([day, daySlots]) => (
          <section key={day}>
            <h2 className="mb-2 text-sm font-semibold text-ink">{day}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {daySlots.map((slot) => {
                const isOn = selected?.startIso === slot.startIso;
                return (
                  <button
                    key={slot.startIso}
                    type="button"
                    disabled={slot.busy}
                    onClick={() => setSelected(slot)}
                    className={`rounded-xl border px-3 py-2.5 text-left text-sm ${
                      slot.busy
                        ? "cursor-not-allowed border-line bg-stone-100 text-stone-400"
                        : isOn
                          ? "border-teal bg-teal text-white"
                          : "border-line bg-white text-ink"
                    }`}
                  >
                    <span className="block font-medium">{slot.label}</span>
                    {slot.busy ? (
                      <span className="text-xs">Busy</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {message ? (
        <p className="rounded-xl bg-teal/10 px-3 py-2 text-sm text-teal-dark">
          {message}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!selected || busy}
        onClick={() => void confirm()}
        className="w-full rounded-full bg-teal px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy
          ? "Booking…"
          : selected
            ? `Book ${selected.dayLabel}, ${selected.label}`
            : "Pick a free slot"}
      </button>
      <p className="text-xs text-stone-500">
        This creates the calendar event and a confirmation draft. It does not
        email the customer until you send the draft.
      </p>
    </div>
  );
}
