import { JobBoard } from "@/components/JobBoard";
import { auth } from "@/lib/auth";
import { importEligibleInbox } from "@/lib/board-import";
import { isDemoMode } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import type { Session } from "next-auth";

async function loadBoardJobs() {
  return prisma.job.findMany({
    include: { photos: true, _count: { select: { smsMessages: true } } },
    orderBy: { lastActivityAt: "desc" },
  });
}

export default async function HomePage() {
  try {
    let session: Session | null = null;
    try {
      session = await auth();
    } catch {
      session = null;
    }

    let jobs = await loadBoardJobs();
    const settings = await getSettings();
    let unreadApprovals = 0;
    try {
      unreadApprovals = await prisma.notification.count({
        where: { readAt: null, type: "booking_approval" },
      });
    } catch {
      unreadApprovals = 0;
    }

    const demo = isDemoMode();
    const googleConnected = Boolean(session?.googleConnected);
    // Demo is cheap (sample threads). Hosted first-run (empty Neon) must fill
    // the board without an Inbox tap after Google sign-in. Later mail uses
    // Inbox, Sync inbox now, or /api/inbox/sync — not a Gmail hit on every board view.
    const shouldAutoImport = demo || jobs.length === 0;
    let imported = 0;
    let inboxError: string | undefined;
    if (shouldAutoImport) {
      try {
        const result = await importEligibleInbox({
          skipPhotos: true,
          skipDeskLabels: !demo,
          maxResults: demo ? 25 : 18,
        });
        imported = result.imported;
        inboxError = result.error;
        if (imported > 0) {
          jobs = await loadBoardJobs();
          unreadApprovals = await prisma.notification.count({
            where: { readAt: null, type: "booking_approval" },
          });
        }
      } catch {
        inboxError =
          "Gmail could not be loaded. Reconnect Google in Settings if this keeps happening.";
      }
    }

    return (
      <JobBoard
        jobs={jobs}
        settings={settings}
        demo={demo}
        googleConnected={googleConnected}
        unreadApprovals={unreadApprovals}
        inboxError={inboxError}
        imported={imported}
      />
    );
  } catch {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-xl font-semibold text-ink">Job board could not load</h1>
        <p className="mt-2 text-sm text-stone-700">
          The database may be waking up. Try again in a moment, or open Settings
          if Google needs a reconnect.
        </p>
        <a
          href="/settings"
          className="mt-4 inline-flex min-h-11 items-center rounded-full bg-teal px-4 py-2.5 text-sm font-semibold text-ink"
        >
          Open Settings
        </a>
      </div>
    );
  }
}
