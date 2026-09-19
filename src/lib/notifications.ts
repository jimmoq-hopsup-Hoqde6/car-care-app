import { JobStatus } from "@prisma/client";
import { syncJobGmailLabelById } from "./gmail-labels";
import { needsBookingApproval } from "./inbox";
import { prisma } from "./prisma";

export async function notifyBookingApproval(input: {
  jobId: string;
  customerName: string;
  body: string;
}) {
  const existing = await prisma.notification.findFirst({
    where: {
      jobId: input.jobId,
      type: "booking_approval",
      readAt: null,
    },
  });
  if (existing) return existing;

  const href = `/jobs/${input.jobId}/book`;
  return prisma.notification.create({
    data: {
      jobId: input.jobId,
      type: "booking_approval",
      title: `${input.customerName} is waiting for your booking approval`,
      body: input.body,
      href,
    },
  });
}

export async function syncInboxNotifications() {
  const { listInboxThreads } = await import("./inbox");
  const threads = await listInboxThreads();
  let created = 0;

  for (const thread of threads) {
    if (thread.ignored || !thread.jobId || !needsBookingApproval(thread.kind)) {
      continue;
    }
    const job = await prisma.job.findUnique({ where: { id: thread.jobId } });
    if (!job) continue;

    if (
      job.status === JobStatus.AWAITING_CUSTOMER ||
      job.status === JobStatus.READY_TO_BOOK
    ) {
      if (job.status === JobStatus.AWAITING_CUSTOMER) {
        await prisma.job.update({
          where: { id: job.id },
          data: { status: JobStatus.READY_TO_BOOK },
        });
        await syncJobGmailLabelById(job.id);
      }
      const note = await notifyBookingApproval({
        jobId: job.id,
        customerName: job.customerName,
        body: thread.snippet,
      });
      if (note.createdAt.getTime() > Date.now() - 2000) created += 1;
    }
  }

  return created;
}

export async function markJobNotificationsRead(jobId: string) {
  await prisma.notification.updateMany({
    where: { jobId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function unreadNotificationCount() {
  return prisma.notification.count({ where: { readAt: null } });
}
