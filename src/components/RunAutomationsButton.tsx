"use client";

import { useState } from "react";
import { runAutomationsAction } from "@/app/actions/automations";

export function RunAutomationsButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const result = await runAutomationsAction();
          const bits = result.queued.map(
            (item) =>
              `${item.customerName}: ${item.type.replace("_", " ")} (${item.reason})`,
          );
          setMessage(
            bits.length
              ? bits.join(" · ")
              : "Nothing was due. Quotes and booking confirmations were left untouched.",
          );
          setBusy(false);
        }}
        className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Running…" : "Run automations now"}
      </button>
      {message ? <p className="text-sm text-stone-600">{message}</p> : null}
    </div>
  );
}
