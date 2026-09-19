"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { syncInboxNowAction } from "@/app/actions/inbox";

export function SyncInboxButton({
  label = "Sync inbox now",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage(null);
          const result = await syncInboxNowAction();
          if (result.error) {
            setMessage(result.error);
          } else if (result.imported > 0) {
            setMessage(
              `Added ${result.imported} ${result.imported === 1 ? "thread" : "threads"} to the job board.`,
            );
          } else {
            setMessage(
              "Inbox is in sync. Eligible threads were already on the board; marketing was left ignored.",
            );
          }
          setBusy(false);
          router.refresh();
        }}
        className={
          className ??
          "inline-flex min-h-11 items-center justify-center rounded-full bg-teal px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
        }
      >
        {busy ? "Syncing…" : label}
      </button>
      {message ? <p className="text-sm text-stone-600">{message}</p> : null}
    </div>
  );
}
