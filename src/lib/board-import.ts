import { JobStatus } from "@prisma/client";
import { runPhotoAndScopeAutomations } from "./automations";
import { syncJobGmailLabelById } from "./gmail-labels";
import { importGmailThreadPhotos } from "./gmail-photos";
import {
  isEligibleForAutoImport,
  loadInbox,
  needsBookingApproval,
  type InboxThread,
} from "./inbox";
import { notifyBookingApproval } from "./notifications";
import { prisma } from "./prisma";
import { detectOutOfScope } from "./scope";
import { getSettings } from "./settings";
import {
  customerRecipientOrNull,
  resolveInboxCustomer,
} from "./customer-mail";
import { formatAuMobile, toE164Au } from "./phone";

export async function findJobForThread(threadId: string) {
  return prisma.job.findFirst({
    where: {
      OR: [{ threadId }, { gmailThreadId: threadId }],
    },
  });
}

function channelForThread(kind: InboxThread["kind"]) {
  if (kind === "website_form") return "website";
  if (kind === "sms") return "sms";
  return "email";
}

/**
 * Create a job from an inbox thread. Idempotent on threadId / gmailThreadId.
 * Does not redirect — callers decide.
 */
export async function importThreadToBoard(thread: InboxThread): Promise<{
  jobId: string;
  created: boolean;
}> {
  const existing = await findJobForThread(thread.id);
  if (existing) {
    return { jobId: existing.id, created: false };
  }

  const customer = resolveInboxCustomer({
    from: thread.from,
    fromEmail: thread.fromEmail,
    replyTo: thread.replyTo,
    subject: thread.subject,
    snippet: `${thread.snippet}\n${thread.bodyText ?? ""}`,
  });
  const nameFrom = customer.name || "Customer";
  const customerEmail =
    customerRecipientOrNull(customer.email) ||
    customerRecipientOrNull(thread.fromEmail);
  const phone = customer.phone?.trim() || null;
  const id = `job-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const bookingReply = needsBookingApproval(thread.kind);
  const status =
    thread.seedStatus ??
    (bookingReply ? JobStatus.READY_TO_BOOK : JobStatus.NEEDS_QUOTE);
  const damageNotes = `${thread.subject}\n\n${thread.snippet}`;
  const outOfScope = detectOutOfScope({
    damageNotes,
    subject: thread.subject,
  });
  const liveThreadId = thread.id.startsWith("demo-") ? null : thread.id;

  await prisma.job.create({
    data: {
      id,
      customerName: nameFrom,
      customerEmail,
      customerPhone: phone ? formatAuMobile(phone) || phone : null,
      customerPhoneE164: toE164Au(phone),
      damageNotes,
      channel: channelForThread(thread.kind),
      threadId: thread.id,
      gmailThreadId: liveThreadId,
      status,
      lastActivityAt: new Date(),
      outOfScope,
    },
  });
  await importGmailThreadPhotos(id, liveThreadId);
  if (status === JobStatus.READY_TO_BOOK || bookingReply) {
    await notifyBookingApproval({
      jobId: id,
      customerName: nameFrom,
      body: thread.snippet,
    });
  }
  await runPhotoAndScopeAutomations(id);
  await syncJobGmailLabelById(id);

  return { jobId: id, created: true };
}

export async function autoImportEligibleInbox(threads: InboxThread[]): Promise<{
  threads: InboxThread[];
  imported: number;
}> {
  const settings = await getSettings();
  if (!settings.autoAddInboxToBoard) {
    return { threads, imported: 0 };
  }

  let imported = 0;
  const next: InboxThread[] = [];
  for (const thread of threads) {
    if (thread.jobId || !isEligibleForAutoImport(thread)) {
      next.push(thread);
      continue;
    }
    try {
      const result = await importThreadToBoard(thread);
      if (result.created) imported += 1;
      next.push({ ...thread, jobId: result.jobId });
    } catch {
      next.push(thread);
    }
  }
  return { threads: next, imported };
}

/** Inbox load + auto-import. Used from /inbox and the daily automation run. */
export async function importEligibleInbox(): Promise<{
  threads: InboxThread[];
  imported: number;
  error?: string;
  source: "gmail" | "demo";
}> {
  const listed = await loadInbox();
  if (listed.error) {
    return {
      threads: listed.threads,
      imported: 0,
      error: listed.error,
      source: listed.source,
    };
  }
  const result = await autoImportEligibleInbox(listed.threads);
  return {
    threads: result.threads,
    imported: result.imported,
    source: listed.source,
  };
}
