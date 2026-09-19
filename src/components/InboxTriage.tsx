"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { addThreadToBoard } from "@/app/actions/inbox";
import {
  SyncInboxButton,
  type InboxRefreshPayload,
} from "@/components/SyncInboxButton";

export type InboxTriageThread = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  kind: string;
  ignored: boolean;
  jobId?: string | null;
  deskLabelName?: string | null;
  canAdd?: boolean;
};

const KIND_LABELS: Record<string, string> = {
  quote_request: "New quote request",
  website_form: "Website form lead",
  sms: "SMS",
  booking_negotiation: "Booking negotiation",
  time_confirmation: "Needs time confirmation",
  marketing: "Marketing — ignore",
  other: "Other",
};

function kindLabel(kind: string) {
  return KIND_LABELS[kind] ?? "Other";
}

function snapshotIsFresh(syncedAt?: string | null, withinMs = 45_000) {
  if (!syncedAt) return false;
  const at = new Date(syncedAt).getTime();
  if (Number.isNaN(at)) return false;
  return Date.now() - at < withinMs;
}

function formatSyncedAt(syncedAt?: string | null) {
  if (!syncedAt) return null;
  const at = new Date(syncedAt);
  if (Number.isNaN(at.getTime())) return null;
  const delta = Date.now() - at.getTime();
  if (delta < 20_000) return "just now";
  if (delta < 60_000) return "less than a minute ago";
  const minutes = Math.round(delta / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  return at.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Adelaide",
  });
}

export function InboxTriage({
  initialThreads,
  initialError,
  initialSource,
  initialSyncedAt,
  live,
  googleConfigured,
}: {
  initialThreads: InboxTriageThread[];
  initialError?: string;
  initialSource: "gmail" | "demo";
  initialSyncedAt?: string | null;
  live: boolean;
  googleConfigured: boolean;
}) {
  const [threads, setThreads] = useState(initialThreads);
  const [inboxError, setInboxError] = useState(initialError);
  const [source, setSource] = useState(initialSource);
  const [syncedAt, setSyncedAt] = useState(initialSyncedAt ?? null);
  const [imported, setImported] = useState(0);
  const [updating, setUpdating] = useState(false);

  const applyResult = useCallback((result: InboxRefreshPayload) => {
    if (result.threads) setThreads(result.threads);
    if (result.source) setSource(result.source);
    if (result.syncedAt !== undefined) setSyncedAt(result.syncedAt ?? null);
    setInboxError(result.error ?? undefined);
    if (typeof result.imported === "number") setImported(result.imported);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fresh =
      snapshotIsFresh(initialSyncedAt) &&
      initialThreads.length > 0 &&
      !initialError;
    if (fresh) return undefined;

    setUpdating(true);
    fetch("/api/inbox/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force: false }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as InboxRefreshPayload & {
          error?: string | null;
        };
        if (cancelled) return;
        if (response.status === 401) {
          setInboxError("Sign in again to refresh Gmail.");
          return;
        }
        applyResult(payload);
      })
      .catch(() => {
        if (!cancelled) {
          setInboxError(
            "Gmail could not be reached just now. The last known inbox is still shown.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setUpdating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applyResult, initialError, initialSyncedAt, initialThreads.length]);

  const active = threads.filter((thread) => !thread.ignored);
  const ignored = threads.filter((thread) => thread.ignored);
  const updatedLabel = formatSyncedAt(syncedAt);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Inbox triage
        </h1>
        <p className="mt-1 text-sm text-muted">
          {live
            ? "Last known threads show immediately. Gmail refresh, auto-import and booking-confirm alerts run in the background — you can leave for Jobs while that finishes. After a customer replies (yes / Saturday / book me in), tap Sync inbox so they move to Ready to book and show in Alerts. Marketing such as Manheim stays ignored."
            : googleConfigured
              ? "Showing sample threads until you connect Google. Eligible ones still land on the demo board automatically."
              : "Demo threads. Eligible quote requests are added to the board automatically. Sync inbox after a customer replies so booking confirms appear in Alerts. Add Google OAuth keys in .env to use the live inbox."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <SyncInboxButton
            onSynced={(result) => {
              applyResult(result);
              setUpdating(false);
            }}
            onBusyChange={setUpdating}
          />
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-dark underline"
          >
            Back to Jobs
          </Link>
        </div>
      </div>

      {updating ? (
        <div
          role="status"
          aria-live="polite"
          className="desk-card flex items-center gap-2 border-teal/30 bg-teal/10 px-4 py-3 text-sm text-ink"
        >
          <span
            className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-teal-dark border-t-transparent"
            aria-hidden
          />
          Updating inbox… You can keep scrolling or open Jobs.
        </div>
      ) : updatedLabel && source === "gmail" ? (
        <p className="text-xs text-muted">Last updated {updatedLabel}.</p>
      ) : null}

      {inboxError ? (
        <div
          role="alert"
          className="desk-card border-amber-200 bg-amber-50 px-4 py-3 text-sm text-ink"
        >
          <p className="font-semibold">Inbox could not load Gmail</p>
          <p className="mt-1 text-muted">{inboxError}</p>
          <Link
            href="/settings"
            className="mt-2 inline-block text-sm font-semibold text-teal-dark underline"
          >
            Open Settings to reconnect Google
          </Link>
        </div>
      ) : null}

      {imported > 0 ? (
        <p className="desk-card border-teal/30 bg-teal/10 px-4 py-2.5 text-sm text-ink">
          Added {imported} {imported === 1 ? "thread" : "threads"} to the job
          board.
        </p>
      ) : null}

      <div className="space-y-3">
        {active.map((thread) => (
          <article key={thread.id} className="desk-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-teal/15 px-2.5 py-0.5 text-xs font-semibold text-teal-dark ring-1 ring-teal/30">
                {kindLabel(thread.kind)}
              </span>
              {thread.deskLabelName ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-950 ring-1 ring-amber-200/80">
                  Gmail: {thread.deskLabelName}
                </span>
              ) : null}
              {thread.jobId ? (
                <Link
                  href={`/jobs/${thread.jobId}`}
                  className="text-xs font-medium text-teal-dark"
                >
                  On the board
                </Link>
              ) : null}
            </div>
            <h2 className="mt-2 font-semibold tracking-tight text-ink">
              {thread.subject}
            </h2>
            <p className="text-sm text-muted">{thread.from}</p>
            <p className="mt-1 text-sm text-stone-500">{thread.snippet}</p>
            {!thread.jobId && thread.canAdd ? (
              <form action={addThreadToBoard.bind(null, thread.id)} className="mt-3">
                <button type="submit" className="desk-btn bg-ink text-white">
                  Add to job board
                </button>
              </form>
            ) : null}
          </article>
        ))}
      </div>

      {active.length === 0 && !inboxError ? (
        <p className="desk-card border-dashed px-5 py-8 text-center text-sm text-muted">
          {updating
            ? "Waiting for Gmail — last known threads will appear here."
            : "No customer threads to show."}
        </p>
      ) : null}

      {ignored.length > 0 ? (
        <details className="desk-card border-dashed p-4">
          <summary className="cursor-pointer text-sm font-semibold text-stone-600">
            Ignored ({ignored.length}) — marketing, Google alerts, and Sinch
          </summary>
          <div className="mt-3 space-y-2">
            {ignored.map((thread) => (
              <p key={thread.id} className="text-sm text-stone-500">
                <span className="font-medium">{thread.subject}</span> · {thread.from}
              </p>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
