import { isDemoMode } from "./env";
import {
  canImportThreadToBoard,
  type InboxThread,
} from "./inbox";
import { prisma } from "./prisma";

export type CachedInboxThread = InboxThread & { canAdd?: boolean };

export type InboxSnapshot = {
  threads: CachedInboxThread[];
  source: "gmail" | "demo";
  error?: string;
  syncedAt: string | null;
};

function withCanAdd(threads: InboxThread[]): CachedInboxThread[] {
  return threads.map((thread) => ({
    ...thread,
    bodyText: (thread.bodyText ?? "").slice(0, 2000) || null,
    canAdd: !thread.jobId && canImportThreadToBoard(thread),
  }));
}

export async function readInboxSnapshot(): Promise<InboxSnapshot> {
  try {
    const row = await prisma.inboxCache.findUnique({ where: { id: "default" } });
    if (row?.payload) {
      const parsed = JSON.parse(row.payload) as CachedInboxThread[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          threads: parsed,
          source: row.source === "gmail" ? "gmail" : "demo",
          error: row.error ?? undefined,
          syncedAt: row.syncedAt?.toISOString() ?? null,
        };
      }
    }
  } catch {
    // Table may not exist yet on a waking host.
  }

  if (isDemoMode()) {
    const { demoInboxThreads } = await import("./inbox");
    const threads = withCanAdd(demoInboxThreads());
    return { threads, source: "demo", syncedAt: null };
  }

  return { threads: [], source: "gmail", syncedAt: null };
}

export async function writeInboxSnapshot(input: {
  threads: InboxThread[];
  source: "gmail" | "demo";
  error?: string;
}) {
  const payload = JSON.stringify(withCanAdd(input.threads));
  const syncedAt = new Date();
  try {
    await prisma.inboxCache.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        payload,
        source: input.source,
        error: input.error ?? null,
        syncedAt,
      },
      update: {
        payload,
        source: input.source,
        error: input.error ?? null,
        syncedAt,
      },
    });
  } catch {
    // Snapshot is a speed cache — Inbox still works without it.
  }
  return { threads: withCanAdd(input.threads), source: input.source, error: input.error, syncedAt: syncedAt.toISOString() };
}

export function snapshotIsFresh(syncedAt?: string | null, withinMs = 45_000) {
  if (!syncedAt) return false;
  const at = new Date(syncedAt).getTime();
  if (Number.isNaN(at)) return false;
  return Date.now() - at < withinMs;
}
