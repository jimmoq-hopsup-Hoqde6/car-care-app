import { JobStatus } from "@prisma/client";
import {
  looksLikeBookingConfirmation,
  looksLikeBookingRequest,
} from "./booking-ops";
import { extractJobIntakeFields } from "./customer-mail";
import { isDemoMode } from "./env";
import { syncJobGmailLabelById } from "./gmail-labels";
import { createGmailDraft } from "./google";
import { needsBookingApproval, type InboxKind, type InboxThread } from "./inbox";
import { prisma } from "./prisma";
import { emailGreeting } from "./quote";
import { getSettings } from "./settings";

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

export function isCustomerBookingReply(
  thread: Pick<InboxThread, "kind" | "snippet" | "bodyText" | "subject">,
  job?: { quoteSentAt?: Date | null; quoteAmount?: number | null; status?: string },
) {
  const text = `${thread.subject ?? ""}\n${thread.snippet ?? ""}\n${thread.bodyText ?? ""}`;
  if (needsBookingApproval(thread.kind)) return true;
  const quoted =
    Boolean(job?.quoteSentAt) ||
    job?.quoteAmount != null ||
    job?.status === JobStatus.AWAITING_CUSTOMER ||
    job?.status === JobStatus.READY_TO_BOOK;
  if (!quoted) return false;
  return looksLikeBookingConfirmation(text) || looksLikeBookingRequest(text);
}

async function maybeDraftBookingHold(input: {
  jobId: string;
  customerName: string;
  customerEmail?: string | null;
  threadId?: string | null;
  snippet: string;
}) {
  const settings = await getSettings();
  if (!settings.autoDraftBookingConfirm) return;
  const existing = await prisma.emailDraft.findFirst({
    where: { jobId: input.jobId, type: "confirmation" },
  });
  if (existing) return;

  const subject = "Booking — I'll lock that day in";
  const body = `${emailGreeting(input.customerName)}

Thanks — I'll add that day to the calendar and send the booking confirmation once the slot is locked in.

Kind regards,
Marcel Kuhn
Mobile Car Scratch Repair Adelaide`;

  const to = input.customerEmail ?? "";
  if (to && !isDemoMode()) {
    await createGmailDraft({
      to,
      from: settings.businessEmail,
      subject,
      body,
      threadId: input.threadId,
    });
  }
  await prisma.emailDraft.create({
    data: {
      jobId: input.jobId,
      type: "confirmation",
      subject,
      body,
    },
  });
}

/**
 * Customer said yes / Saturday / book me in. Move to Ready to book, raise an
 * alert, bump last activity. Never auto-sends a booking confirmation.
 */
export async function applyCustomerBookingReply(input: {
  jobId: string;
  snippet: string;
  subject?: string | null;
  bodyText?: string | null;
  kind?: InboxKind;
}): Promise<{ updated: boolean; alerted: boolean }> {
  const job = await prisma.job.findUnique({ where: { id: input.jobId } });
  if (!job || job.outOfScope) return { updated: false, alerted: false };
  if (job.status === JobStatus.BOOKED || job.status === JobStatus.DONE) {
    return { updated: false, alerted: false };
  }

  const text = `${input.subject ?? ""}\n${input.snippet}\n${input.bodyText ?? ""}`;
  if (
    !isCustomerBookingReply(
      {
        kind: input.kind ?? "other",
        snippet: input.snippet,
        bodyText: input.bodyText ?? "",
        subject: input.subject ?? "",
      },
      job,
    )
  ) {
    return { updated: false, alerted: false };
  }

  const replyLine = (input.snippet || text).trim();
  const alreadyNoted = Boolean(replyLine && job.damageNotes?.includes(replyLine));
  const alreadyReady = job.status === JobStatus.READY_TO_BOOK;
  if (alreadyReady) {
    const intake = extractJobIntakeFields(text);
    if (!alreadyNoted && replyLine) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          damageNotes: [job.damageNotes, `Customer reply: ${replyLine}`]
            .filter(Boolean)
            .join("\n\n"),
          address: intake.address || job.address,
          suburb: intake.suburb || job.suburb,
        },
      });
    }
    const note = await notifyBookingApproval({
      jobId: job.id,
      customerName: job.customerName,
      body: replyLine,
    });
    return { updated: false, alerted: Boolean(note) };
  }

  const intake = extractJobIntakeFields(text);
  const now = new Date();
  const nextNotes =
    alreadyNoted || !replyLine
      ? job.damageNotes
      : [job.damageNotes, `Customer reply: ${replyLine}`].filter(Boolean).join("\n\n");

  await prisma.job.update({
    where: { id: job.id },
    data: {
      status: JobStatus.READY_TO_BOOK,
      lastActivityAt: now,
      lastCustomerReplyAt: now,
      damageNotes: nextNotes,
      address: intake.address || job.address,
      suburb: intake.suburb || job.suburb,
    },
  });
  await syncJobGmailLabelById(job.id);
  const note = await notifyBookingApproval({
    jobId: job.id,
    customerName: job.customerName,
    body: replyLine,
  });
  try {
    await maybeDraftBookingHold({
      jobId: job.id,
      customerName: job.customerName,
      customerEmail: job.customerEmail,
      threadId: job.gmailThreadId ?? job.threadId,
      snippet: replyLine,
    });
  } catch {
    // Draft is optional; the alert still lands.
  }

  return { updated: true, alerted: Boolean(note) };
}

export async function applyBookingRepliesFromInbox(threads: InboxThread[]) {
  let updated = 0;
  let alerted = 0;
  for (const thread of threads) {
    if (thread.ignored || !thread.jobId) continue;
    const result = await applyCustomerBookingReply({
      jobId: thread.jobId,
      snippet: thread.snippet,
      subject: thread.subject,
      bodyText: thread.bodyText,
      kind: thread.kind,
    });
    if (result.updated) updated += 1;
    if (result.alerted) alerted += 1;
  }
  return { updated, alerted };
}

export async function syncInboxNotifications(threads?: InboxThread[]) {
  const { listInboxThreads } = await import("./inbox");
  const items = threads ?? (await listInboxThreads());
  const { alerted } = await applyBookingRepliesFromInbox(items);
  return alerted;
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
