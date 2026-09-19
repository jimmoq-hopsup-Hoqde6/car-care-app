import Link from "next/link";
import type { Session } from "next-auth";
import { addThreadToBoard } from "@/app/actions/inbox";
import { auth } from "@/lib/auth";
import { canImportThreadToBoard, importEligibleInbox } from "@/lib/board-import";
import { isDemoMode, isGoogleConfigured } from "@/lib/env";
import { kindLabel, type InboxThread } from "@/lib/inbox";
import { syncInboxNotifications } from "@/lib/notifications";
import { SyncInboxButton } from "@/components/SyncInboxButton";

export default async function InboxPage() {
  let session: Session | null = null;
  try {
    session = await auth();
  } catch {
    session = null;
  }
  let threads: InboxThread[] = [];
  let imported = 0;
  let inboxError: string | undefined;
  let source: "gmail" | "demo" = "demo";

  try {
    const result = await importEligibleInbox();
    threads = result.threads;
    imported = result.imported;
    inboxError = result.error;
    source = result.source;
  } catch {
    inboxError =
      "Gmail could not be loaded. Reconnect Google in Settings if this keeps happening.";
  }

  try {
    await syncInboxNotifications(threads);
  } catch {
    // Notifications should not take Inbox down.
  }

  const active = threads.filter((thread) => !thread.ignored);
  const ignored = threads.filter((thread) => thread.ignored);
  const live = Boolean(session?.googleConnected) && !isDemoMode() && source === "gmail";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Inbox triage
        </h1>
        <p className="mt-1 text-sm text-muted">
          {live
            ? "Live Gmail from the last 45 days. Eligible quote, New Quote Request forms, booking and SMS threads are added to the job board automatically. After a customer replies (yes / Saturday / book me in), tap Sync inbox so they move to Ready to book and show in Alerts. Marketing such as Manheim stays ignored."
            : isGoogleConfigured()
              ? "Showing sample threads until you connect Google. Eligible ones still land on the demo board automatically."
              : "Demo threads. Eligible quote requests are added to the board automatically. Sync inbox after a customer replies so booking confirms appear in Alerts. Add Google OAuth keys in .env to use the live inbox."}
        </p>
        <div className="mt-3">
          <SyncInboxButton />
        </div>
      </div>

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
          <article
            key={thread.id}
            className="desk-card p-4"
          >
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
            {!thread.jobId && canImportThreadToBoard(thread) ? (
              <form action={addThreadToBoard.bind(null, thread.id)} className="mt-3">
                <button
                  type="submit"
                  className="desk-btn bg-ink text-white"
                >
                  Add to job board
                </button>
              </form>
            ) : null}
          </article>
        ))}
      </div>

      {active.length === 0 && !inboxError ? (
        <p className="desk-card border-dashed px-5 py-8 text-center text-sm text-muted">
          No customer threads to show.
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
