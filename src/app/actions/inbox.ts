"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { findJobForThread, importThreadToBoard } from "@/lib/board-import";
import { loadInbox } from "@/lib/inbox";

export async function addThreadToBoard(threadId: string) {
  const existing = await findJobForThread(threadId);
  if (existing) {
    redirect(`/jobs/${existing.id}`);
  }

  const { threads } = await loadInbox();
  const thread = threads.find((item) => item.id === threadId);
  if (!thread) {
    throw new Error("Thread not found.");
  }

  const { jobId } = await importThreadToBoard(thread);

  revalidatePath("/");
  revalidatePath("/inbox");
  revalidatePath("/notifications");
  redirect(`/jobs/${jobId}`);
}
