"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canImportThreadToBoard,
  findJobForThread,
  importThreadToBoard,
  refreshInboxInteractive,
} from "@/lib/board-import";
import { readInboxSnapshot } from "@/lib/inbox-cache";
import { loadInbox } from "@/lib/inbox";

export async function addThreadToBoard(threadId: string) {
  const existing = await findJobForThread(threadId);
  if (existing) {
    redirect(`/jobs/${existing.id}`);
  }

  const snapshot = await readInboxSnapshot();
  let thread = snapshot.threads.find((item) => item.id === threadId);
  if (!thread) {
    const { threads } = await loadInbox({
      maxResults: 18,
      skipDeskLabels: true,
    });
    thread = threads.find((item) => item.id === threadId);
  }
  if (!thread || !canImportThreadToBoard(thread)) {
    redirect("/inbox");
    return;
  }

  const { jobId, refused } = await importThreadToBoard(thread);
  if (!jobId || refused) {
    redirect("/inbox");
    return;
  }

  revalidatePath("/");
  revalidatePath("/inbox");
  revalidatePath("/notifications");
  redirect(`/jobs/${jobId}`);
}

export async function syncInboxNowAction() {
  try {
    const result = await refreshInboxInteractive({ force: true });
    revalidatePath("/");
    revalidatePath("/inbox");
    revalidatePath("/notifications");
    return {
      imported: result.imported,
      error: result.error,
      threads: result.threads,
      source: result.source,
      syncedAt: result.syncedAt,
    };
  } catch {
    return {
      imported: 0,
      error:
        "Gmail could not be loaded. Reconnect Google in Settings if this keeps happening.",
    };
  }
}
