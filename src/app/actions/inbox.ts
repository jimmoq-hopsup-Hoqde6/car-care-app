"use server";

import { JobStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { listInboxThreads } from "@/lib/inbox";
import { prisma } from "@/lib/prisma";

export async function addThreadToBoard(threadId: string) {
  const existing = await prisma.job.findFirst({
    where: {
      OR: [{ threadId }, { gmailThreadId: threadId }],
    },
  });
  if (existing) {
    redirect(`/jobs/${existing.id}`);
  }

  const threads = await listInboxThreads();
  const thread = threads.find((item) => item.id === threadId);
  if (!thread) {
    throw new Error("Thread not found.");
  }

  const nameFrom = thread.from.replace(/<[^>]+>/, "").trim() || "Customer";
  const id = `job-${Date.now().toString(36)}`;

  await prisma.job.create({
    data: {
      id,
      customerName: nameFrom,
      customerEmail: thread.fromEmail,
      damageNotes: `${thread.subject}\n\n${thread.snippet}`,
      channel: thread.kind === "website_form" ? "website" : "email",
      threadId,
      gmailThreadId: threadId.startsWith("demo-") ? null : threadId,
      status: JobStatus.NEEDS_QUOTE,
    },
  });

  revalidatePath("/");
  revalidatePath("/inbox");
  redirect(`/jobs/${id}`);
}
