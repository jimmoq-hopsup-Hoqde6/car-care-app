"use client";

import { useMemo, useState } from "react";
import type { Job, Photo, PriceBand } from "@prisma/client";
import { saveQuoteAction } from "@/app/actions/quotes";
import { formatAUD } from "@/lib/money";
import { buildQuoteEmail } from "@/lib/quote";

type Props = {
  job: Job & { photos: Photo[] };
  priceBands: PriceBand[];
  items: string[];
};

export function QuoteComposer({ job, priceBands, items }: Props) {
  const [amount, setAmount] = useState(
    job.quoteAmount != null ? String(job.quoteAmount) : "",
  );
  const [repairItems, setRepairItems] = useState(
    items.length ? items : [""],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return buildQuoteEmail({
      repairItems: repairItems.filter((item) => item.trim()),
      total: parsed,
    });
  }, [amount, repairItems]);

  async function submit(send: boolean) {
    setBusy(true);
    setMessage(null);
    const result = await saveQuoteAction({
      jobId: job.id,
      amount,
      repairItems,
      send,
    });
    setMessage(result.message);
    setBusy(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="space-y-4">
        <div className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-sm font-semibold text-ink">Customer</h2>
          <p className="mt-1 text-lg font-semibold">{job.customerName}</p>
          <p className="text-sm text-stone-600">
            {job.vehicle} · {job.suburb}
          </p>
          <p className="mt-2 text-sm text-stone-600">{job.damageNotes}</p>
          {job.photos.length > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {job.photos.map((photo) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={photo.id}
                  src={photo.url}
                  alt={photo.filename ?? "Damage photo"}
                  width={240}
                  height={96}
                  className="h-24 w-full rounded-xl bg-stone-200 object-cover ring-1 ring-line"
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-line bg-card p-4">
          <label className="text-sm font-semibold text-ink" htmlFor="amount">
            Your price (AUD)
          </label>
          <p className="mt-1 text-xs text-stone-500">
            Type the figure yourself. The app will not invent one.
          </p>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
              $
            </span>
            <input
              id="amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-line bg-white py-3 pl-7 pr-3 text-lg font-semibold text-ink outline-none ring-teal focus:ring-2"
            />
          </div>

          {priceBands.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-stone-500">
                Your price bands
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {priceBands.map((band) => (
                  <button
                    key={band.id}
                    type="button"
                    disabled={band.amount == null}
                    onClick={() => {
                      if (band.amount != null) setAmount(String(band.amount));
                    }}
                    className="rounded-full border border-line px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {band.name}
                    {band.amount != null ? ` · ${formatAUD(band.amount)}` : " · set in Settings"}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-sm font-semibold text-ink">Repair items</h2>
          <div className="mt-2 space-y-2">
            {repairItems.map((item, index) => (
              <div key={index} className="flex gap-2">
                <input
                  value={item}
                  onChange={(event) => {
                    const next = [...repairItems];
                    next[index] = event.target.value;
                    setRepairItems(next);
                  }}
                  className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal"
                />
                <button
                  type="button"
                  onClick={() =>
                    setRepairItems(repairItems.filter((_, i) => i !== index))
                  }
                  className="text-sm text-stone-500"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setRepairItems([...repairItems, ""])}
            className="mt-2 text-sm font-medium text-teal"
          >
            Add item
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-2xl border border-line bg-white p-4">
          <h2 className="text-sm font-semibold text-ink">Email preview</h2>
          <p className="mt-1 text-xs text-stone-500">
            Matches Marcel&apos;s quote template. Default is draft — nothing sends
            until you tap Send.
          </p>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-stone-800">
            {preview ??
              "Enter a price to preview the quote. Estimated total stays blank until you do."}
          </pre>
        </div>

        {message ? (
          <p className="rounded-xl bg-teal/10 px-3 py-2 text-sm text-teal-dark">
            {message}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={() => submit(false)}
            className="flex-1 rounded-full bg-teal px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save as draft"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (
                confirm(
                  "Send this quote now? Only do this if you have checked the price.",
                )
              ) {
                void submit(true);
              }
            }}
            className="flex-1 rounded-full border border-line bg-white px-4 py-3 text-sm font-semibold text-ink disabled:opacity-60"
          >
            Send now
          </button>
        </div>
      </section>
    </div>
  );
}
