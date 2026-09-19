import { JobStatus } from "@prisma/client";
import { runPhotoAndScopeAutomations } from "./automations";
import { syncJobGmailLabelById } from "./gmail-labels";
import { importGmailThreadPhotos } from "./gmail-photos";
import {
  canImportThreadToBoard,
  isEligibleForAutoImport,
  loadInbox,
  needsBookingApproval,
  type InboxThread,
} from "./inbox";
import {
  readInboxSnapshot,
  snapshotIsFresh,
  writeInboxSnapshot,
} from "./inbox-cache";
import {
  applyCustomerBookingReply,
  notifyBookingApproval,
  syncInboxNotifications,
} from "./notifications";
import { formatAuMobile, toE164Au } from "./phone";
import { prisma } from "./prisma";
import { detectOutOfScope } from "./scope";
import { getSettings } from "./settings";
import {
  customerRecipientOrNull,
  extractJobIntakeFields,
  isJunkBoardJob,
  resolveInboxCustomer,
} from "./customer-mail";

export { canImportThreadToBoard };

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

export async function removeJunkSystemJobs() {
  const jobs = await prisma.job.findMany({
    where: { isDemo: false },
    select: { id: true, customerName: true, customerEmail: true },
  });
  const junk = jobs.filter(isJunkBoardJob);
  if (junk.length === 0) return 0;
  await prisma.job.deleteMany({ where: { id: { in: junk.map((job) => job.id) } } });
  return junk.length;
}

/**
 * Create a job from an inbox thread. Idempotent on threadId / gmailThreadId.
 * Does not redirect — callers decide.
 */
export async function importThreadToBoard(
  thread: InboxThread,
  options?: { skipPhotos?: boolean },
): Promise<{
  jobId: string;
  created: boolean;
  refused?: boolean;
}> {
  const existing = await findJobForThread(thread.id);
  if (existing) {
    try {
      await applyCustomerBookingReply({
        jobId: existing.id,
        snippet: thread.snippet,
        subject: thread.subject,
        bodyText: thread.bodyText,
        kind: thread.kind,
      });
    } catch {
      // Existing job still opens if the booking-reply step fails.
    }
    return { jobId: existing.id, created: false };
  }

  if (!canImportThreadToBoard(thread)) {
    return { jobId: "", created: false, refused: true };
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
    (thread.kind === "sms" ? null : customerRecipientOrNull(thread.fromEmail));
  const phone = customer.phone?.trim() || null;
  const intake = extractJobIntakeFields(
    `${thread.subject}\n${thread.snippet}\n${thread.bodyText ?? ""}`,
  );
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
      vehicle: intake.vehicle || null,
      suburb: intake.suburb || null,
      address: intake.address || null,
      damageNotes,
      channel: channelForThread(thread.kind),
      threadId: thread.id,
      gmailThreadId: liveThreadId,
      status,
      lastActivityAt: new Date(),
      lastCustomerReplyAt: bookingReply ? new Date() : undefined,
      outOfScope,
    },
  });
  if (!options?.skipPhotos) {
    try {
      await importGmailThreadPhotos(id, liveThreadId);
    } catch {
      // Job still lands on the board if Gmail attachments fail.
    }
  }
  if (status === JobStatus.READY_TO_BOOK || bookingReply) {
    await notifyBookingApproval({
      jobId: id,
      customerName: nameFrom,
      body: thread.snippet,
    });
  }
  if (customerEmail) {
    await runPhotoAndScopeAutomations(id);
  }
  await syncJobGmailLabelById(id);

  return { jobId: id, created: true };
}

export async function autoImportEligibleInbox(
  threads: InboxThread[],
  options?: { skipPhotos?: boolean },
): Promise<{
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
      const result = await importThreadToBoard(thread, options);
      if (result.refused || !result.jobId) {
        next.push(thread);
        continue;
      }
      if (result.created) imported += 1;
      next.push({ ...thread, jobId: result.jobId });
    } catch {
      next.push(thread);
    }
  }
  return { threads: next, imported };
}

export type InboxSyncOptions = {
  skipPhotos?: boolean;
  skipDeskLabels?: boolean;
  maxResults?: number;
};

/** Inbox load + auto-import. Cron keeps photos; Inbox UI skips them. */
export async function importEligibleInbox(options?: InboxSyncOptions): Promise<{
  threads: InboxThread[];
  imported: number;
  error?: string;
  source: "gmail" | "demo";
  syncedAt?: string;
}> {
  try {
    await removeJunkSystemJobs();
  } catch {
    // Sweep is best-effort; Inbox still loads.
  }
  const listed = await loadInbox({
    maxResults: options?.maxResults,
    skipDeskLabels: options?.skipDeskLabels,
  });
  if (listed.error) {
    const snapshot = await writeInboxSnapshot({
      threads: listed.threads,
      source: listed.source,
      error: listed.error,
    });
    return {
      threads: listed.threads,
      imported: 0,
      error: listed.error,
      source: listed.source,
      syncedAt: snapshot.syncedAt,
    };
  }
  const result = await autoImportEligibleInbox(listed.threads, {
    skipPhotos: options?.skipPhotos,
  });
  try {
    await syncInboxNotifications(result.threads);
  } catch {
    // Booking alerts are best-effort; the board still loads.
  }
  const snapshot = await writeInboxSnapshot({
    threads: result.threads,
    source: listed.source,
  });
  return {
    threads: result.threads,
    imported: result.imported,
    source: listed.source,
    syncedAt: snapshot.syncedAt,
  };
}

const INTERACTIVE_INBOX_MAX = 18;

/** Phone Inbox / Sync inbox — skip photos and desk-label writes; reuse a fresh snapshot. */
export async function refreshInboxInteractive(options?: { force?: boolean }) {
  if (!options?.force) {
    const snap = await readInboxSnapshot();
    if (
      snapshotIsFresh(snap.syncedAt) &&
      snap.threads.length > 0 &&
      !snap.error
    ) {
      return {
        threads: snap.threads,
        imported: 0,
        source: snap.source,
        error: snap.error,
        syncedAt: snap.syncedAt,
        skipped: true,
      };
    }
  }
  const result = await importEligibleInbox({
    skipPhotos: true,
    skipDeskLabels: true,
    maxResults: INTERACTIVE_INBOX_MAX,
  });
  return { ...result, skipped: false };
}
