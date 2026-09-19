"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type InboxRefreshPayload = {
  threads?: Array<{
    id: string;
    from: string;
    subject: string;
    snippet: string;
    kind: string;
    ignored: boolean;
    jobId?: string | null;
    deskLabelName?: string | null;
    canAdd?: boolean;
  }>;
  imported?: number;
  error?: string | null;
  source?: "gmail" | "demo";
  syncedAt?: string | null;
  skipped?: boolean;
};

export function SyncInboxButton({
  label = "Sync inbox now",
  className,
  onSynced,
  onBusyChange,
}: {
  label?: string;
  className?: string;
  onSynced?: (result: InboxRefreshPayload) => void;
  onBusyChange?: (busy: boolean) => void;
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
          onBusyChange?.(true);
          setMessage(null);
          try {
            const response = await fetch("/api/inbox/refresh", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ force: true }),
            });
            const result = (await response.json()) as InboxRefreshPayload & {
              error?: string | null;
            };
            if (response.status === 401) {
              setMessage("Sign in again to sync Gmail.");
            } else if (result.error) {
              setMessage(result.error);
            } else if ((result.imported ?? 0) > 0) {
              setMessage(
                `Added ${result.imported} ${result.imported === 1 ? "thread" : "threads"} to the job board.`,
              );
            } else {
              setMessage(
                "Inbox is in sync. Eligible threads were already on the board; marketing was left ignored.",
              );
            }
            onSynced?.(result);
          } catch {
            setMessage(
              "Gmail could not be loaded. Reconnect Google in Settings if this keeps happening.",
            );
          }
          setBusy(false);
          onBusyChange?.(false);
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
