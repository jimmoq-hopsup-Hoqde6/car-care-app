import Link from "next/link";
import { addThreadToBoard } from "@/app/actions/inbox";
import { auth } from "@/lib/auth";
import { isDemoMode, isGoogleConfigured } from "@/lib/env";
import { kindLabel, listInboxThreads } from "@/lib/inbox";
import { syncInboxNotifications } from "@/lib/notifications";

export default async function InboxPage() {
  const session = await auth();
  const threads = await listInboxThreads();
  await syncInboxNotifications();
  const active = threads.filter((thread) => !thread.ignored);
  const ignored = threads.filter((thread) => thread.ignored);
  const live = Boolean(session?.googleConnected) && !isDemoMode();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Inbox triage</h1>
        <p className="text-sm text-stone-600">
          {live
            ? "Live Gmail threads from the last 45 days. Marketing such as Manheim is parked below."
            : isGoogleConfigured()
              ? "Showing sample threads until you connect Google."
              : "Demo threads. Add Google OAuth keys in .env to use the real inbox."}
        </p>
      </div>

      <div className="space-y-3">
        {active.map((thread) => (
          <article
            key={thread.id}
            className="rounded-2xl border border-line bg-card p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-teal/10 px-2.5 py-0.5 text-xs font-semibold text-teal-dark">
                {kindLabel(thread.kind)}
              </span>
              {thread.jobId ? (
                <Link
                  href={`/jobs/${thread.jobId}`}
                  className="text-xs font-medium text-teal"
                >
                  Open job
                </Link>
              ) : null}
            </div>
            <h2 className="mt-2 font-semibold text-ink">{thread.subject}</h2>
            <p className="text-sm text-stone-600">{thread.from}</p>
            <p className="mt-1 text-sm text-stone-500">{thread.snippet}</p>
            {!thread.jobId ? (
              <form action={addThreadToBoard.bind(null, thread.id)} className="mt-3">
                <button
                  type="submit"
                  className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Add to job board
                </button>
              </form>
            ) : null}
          </article>
        ))}
      </div>

      {ignored.length > 0 ? (
        <details className="rounded-2xl border border-dashed border-line bg-white/50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-stone-600">
            Ignored ({ignored.length}) — marketing and auctions
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
