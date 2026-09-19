"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  findJobForThread,
  importEligibleInbox,
  importThreadToBoard,
} from "@/lib/board-import";
import { loadInbox } from "@/lib/inbox";

export async function addThreadToBoard(threadId: string) {
  const existing = await findJobForThread(threadId);
  if (existing) {
    redirect(`/jobs/${existing.id}`);
  }

  const { threads } = await loadInbox();
  const thread = threads.find((item) => item.id === threadId);
  if (!thread) {
    redirect("/inbox");
    return;
  }

  const { jobId } = await importThreadToBoard(thread);

  revalidatePath("/");
  revalidatePath("/inbox");
  revalidatePath("/notifications");
  redirect(`/jobs/${jobId}`);
}

export async function syncInboxNowAction() {
  try {
    const result = await importEligibleInbox();
    revalidatePath("/");
    revalidatePath("/inbox");
    revalidatePath("/notifications");
    return {
      imported: result.imported,
      error: result.error,
    };
  } catch {
    return {
      imported: 0,
      error:
        "Gmail could not be loaded. Reconnect Google in Settings if this keeps happening.",
    };
  }
}
