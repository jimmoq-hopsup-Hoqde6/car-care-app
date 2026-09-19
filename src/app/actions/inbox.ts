"use server";

import { JobStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runPhotoAndScopeAutomations } from "@/lib/automations";
import { syncJobGmailLabelById } from "@/lib/gmail-labels";
import { importGmailThreadPhotos } from "@/lib/gmail-photos";
import { listInboxThreads, needsBookingApproval } from "@/lib/inbox";
import { notifyBookingApproval } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { detectOutOfScope } from "@/lib/scope";

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

  const bookingReply = needsBookingApproval(thread.kind);
  const status =
    thread.seedStatus ??
    (bookingReply ? JobStatus.READY_TO_BOOK : JobStatus.NEEDS_QUOTE);
  const damageNotes = `${thread.subject}\n\n${thread.snippet}`;
  const outOfScope = detectOutOfScope({
    damageNotes,
    subject: thread.subject,
  });
  await prisma.job.create({
    data: {
      id,
      customerName: nameFrom,
      customerEmail: thread.fromEmail,
      damageNotes,
      channel: thread.kind === "website_form" ? "website" : "email",
      threadId,
      gmailThreadId: threadId.startsWith("demo-") ? null : threadId,
      status,
      lastActivityAt: new Date(),
      outOfScope,
    },
  });
  await importGmailThreadPhotos(id, threadId.startsWith("demo-") ? null : threadId);
  if (status === JobStatus.READY_TO_BOOK || bookingReply) {
    await notifyBookingApproval({
      jobId: id,
      customerName: nameFrom,
      body: thread.snippet,
    });
  }
  await runPhotoAndScopeAutomations(id);
  await syncJobGmailLabelById(id);

  revalidatePath("/");
  revalidatePath("/inbox");
  revalidatePath("/notifications");
  redirect(`/jobs/${id}`);
}
