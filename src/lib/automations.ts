import type { Job } from "@prisma/client";
import { google } from "googleapis";
import { touchJobActivity } from "./activity-server";
import {
  buildFollowUpEmail,
  buildPhotoAskEmail,
  buildReviewAskEmail,
  buildScopeDeclineEmail,
  followUpSubject,
  photoAskSubject,
  reviewAskSubject,
  scopeDeclineSubject,
} from "./automation-copy";
import { followUpClockStart, followUpPhase, reviewAskPhase } from "./automation-status";
import { isDemoMode } from "./env";
import { syncJobGmailLabelById } from "./gmail-labels";
import { createGmailDraft, encodeRfc822 } from "./google";
import { getStoredOAuthClient } from "./google-tokens";
import { formSaysHasPhotos, hasUsablePhotos } from "./photos";
import { ownerMobileE164, toE164Au } from "./phone";
import { parseRepairItems } from "./quote";
import { detectOutOfScope } from "./scope";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { buildSmsFollowUp, buildSmsPhotoAsk } from "./sms/copy";
import { sendSms } from "./sms/provider";
import { customerRecipientOrNull, isCustomerReplyEmail } from "./customer-mail";

export type AutomationType =
  | "follow_up"
  | "review_ask"
  | "photo_ask"
  | "scope_decline";

export type AutomationRunResult = {
  demo: boolean;
  emailed: boolean;
  followUps: number;
  reviewAsks: number;
  photoAsks: number;
  declines: number;
  inboxImported: number;
  queued: Array<{
    jobId: string;
    customerName: string;
    type: AutomationType;
    delivered: boolean;
    reason: string;
  }>;
};

function assertAutoSendType(type: AutomationType) {
  if (type === "photo_ask") {
    throw new Error("Photo-ask never auto-sends — draft only.");
  }
  if (type === "follow_up" || type === "review_ask" || type === "scope_decline") {
    return;
  }
  throw new Error("Refusing to auto-send — that email type is not allowed.");
}

async function detectCustomerReply(job: Job): Promise<Date | null> {
  if (isDemoMode()) return job.lastCustomerReplyAt;
  const threadId = job.gmailThreadId ?? job.threadId;
  if (!threadId || threadId.startsWith("demo-")) return job.lastCustomerReplyAt;

  const oauth = await getStoredOAuthClient();
  if (!oauth) return job.lastCustomerReplyAt;

  const gmail = google.gmail({ version: "v1", auth: oauth });
  try {
    const detail = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "metadata",
      metadataHeaders: ["From"],
    });
    const clock = followUpClockStart(job);
    const customer = job.customerEmail?.toLowerCase();
    let latest: Date | null = job.lastCustomerReplyAt;
    for (const message of detail.data.messages ?? []) {
      const from =
        message.payload?.headers?.find(
          (header) => header.name?.toLowerCase() === "from",
        )?.value ?? "";
      const internal = message.internalDate
        ? new Date(Number(message.internalDate))
        : null;
      if (!internal || !customer || !from.toLowerCase().includes(customer)) {
        continue;
      }
      if (clock && internal.getTime() <= clock.getTime()) continue;
      if (!latest || internal > latest) latest = internal;
    }
    return latest;
  } catch {
    return job.lastCustomerReplyAt;
  }
}

async function deliverAutomation(input: {
  type: AutomationType;
  to: string;
  from: string;
  subject: string;
  body: string;
  threadId?: string | null;
}): Promise<{ delivered: boolean; reason: string; error?: string }> {
  assertAutoSendType(input.type);

  if (!isCustomerReplyEmail(input.to)) {
    return {
      delivered: false,
      reason: "refused — not a customer inbox",
    };
  }

  if (isDemoMode()) {
    return {
      delivered: false,
      reason: "demo — queued only, no email sent",
    };
  }

  const oauth = await getStoredOAuthClient();
  if (!oauth) {
    return {
      delivered: false,
      reason: "no Google connection — queued only",
    };
  }

  try {
    const gmail = google.gmail({ version: "v1", auth: oauth });
    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodeRfc822({
          to: input.to,
          from: input.from,
          subject: input.subject,
          body: input.body,
        }),
        threadId: input.threadId ?? undefined,
      },
    });
    return { delivered: true, reason: "sent via Gmail" };
  } catch (error) {
    return {
      delivered: false,
      reason: "Gmail send failed",
      error: error instanceof Error ? error.message : "Unknown Gmail error",
    };
  }
}

async function maybeQueueAutomationSms(input: {
  job: Job;
  type: "photo_ask" | "follow_up";
  enabled: boolean;
  demo: boolean;
}) {
  if (!input.enabled) return;
  const to = toE164Au(input.job.customerPhoneE164 || input.job.customerPhone);
  if (!to) return;
  const body =
    input.type === "photo_ask"
      ? buildSmsPhotoAsk(input.job.customerName)
      : buildSmsFollowUp(input.job.customerName);
  const result = await sendSms({ to, body });
  await prisma.smsMessage.create({
    data: {
      jobId: input.job.id,
      direction: "outbound",
      body,
      fromNumber: ownerMobileE164(),
      toNumber: to,
      provider: "messagemedia",
      providerId: result.id,
      status: result.status,
      delivered: result.delivered,
      demo: input.demo || result.demo,
      type: input.type,
      error: result.error,
    },
  });
}

async function queueEvent(input: {
  jobId: string;
  type: AutomationType;
  subject: string;
  body: string;
  toEmail: string;
  delivered: boolean;
  demo: boolean;
  error?: string;
}) {
  await prisma.automationEvent.create({
    data: {
      jobId: input.jobId,
      type: input.type,
      subject: input.subject,
      body: input.body,
      toEmail: input.toEmail,
      delivered: input.delivered,
      demo: input.demo,
      error: input.error,
    },
  });
}

export async function runPhotoAndScopeAutomations(
  jobId: string,
  now = new Date(),
): Promise<AutomationRunResult["queued"]> {
  const settings = await getSettings();
  const demo = isDemoMode();
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { photos: true },
  });
  if (!job) return [];
  return processPhotoAndScope(job, settings, demo, now);
}

async function processPhotoAndScope(
  job: Job & { photos: { id: string }[] },
  settings: Awaited<ReturnType<typeof getSettings>>,
  demo: boolean,
  now: Date,
): Promise<AutomationRunResult["queued"]> {
  const queued: AutomationRunResult["queued"] = [];
  const outOfScope =
    job.outOfScope ||
    detectOutOfScope({
      vehicle: job.vehicle,
      suburb: job.suburb,
      damageNotes: job.damageNotes,
      repairItems: parseRepairItems(job.repairItems),
    });

  if (outOfScope && !job.outOfScope) {
    await prisma.job.update({
      where: { id: job.id },
      data: { outOfScope: true, lastActivityAt: now },
    });
  }

  if (outOfScope && !job.declinedAt) {
    const to = customerRecipientOrNull(job.customerEmail, settings.businessEmail);
    if (!to) return queued;
    const subject = scopeDeclineSubject();
    const body = buildScopeDeclineEmail(job.customerName);
    let delivered = false;
    let reason = "decline draft saved — not sent";
    let error: string | undefined;
    if (settings.autoDeclineOutOfScope) {
      const result = await deliverAutomation({
        type: "scope_decline",
        to,
        from: settings.businessEmail,
        subject,
        body,
        threadId: job.gmailThreadId ?? job.threadId,
      });
      delivered = result.delivered;
      reason = result.reason;
      error = result.error;
    } else if (!demo) {
      await createGmailDraft({
        to,
        from: settings.businessEmail,
        subject,
        body,
        threadId: job.gmailThreadId ?? job.threadId,
      });
      reason = "decline Gmail draft created — waiting for your send";
    }
    await prisma.emailDraft.create({
      data: {
        jobId: job.id,
        type: "scope_decline",
        subject,
        body,
      },
    });
    await queueEvent({
      jobId: job.id,
      type: "scope_decline",
      subject,
      body,
      toEmail: to,
      delivered,
      demo,
      error,
    });
    await prisma.job.update({
      where: { id: job.id },
      data: {
        outOfScope: true,
        declinedAt: now,
        lastActivityAt: now,
        lastOutboundAt: delivered ? now : job.lastOutboundAt,
      },
    });
    await syncJobGmailLabelById(job.id);
    queued.push({
      jobId: job.id,
      customerName: job.customerName,
      type: "scope_decline",
      delivered,
      reason,
    });
    return queued;
  }

  if (outOfScope) return queued;

  const usablePhotos =
    hasUsablePhotos(job.photos, job.damageNotes) ||
    formSaysHasPhotos(job.damageNotes);
  const photoTo = customerRecipientOrNull(
    job.customerEmail,
    settings.businessEmail,
  );
  const needsPhotoAsk =
    settings.autoAskPhotos &&
    !job.photoAskSentAt &&
    !usablePhotos &&
    job.status === "NEEDS_QUOTE" &&
    Boolean(photoTo);

  if (needsPhotoAsk && photoTo) {
    const service =
      parseRepairItems(job.repairItems)[0] ||
      job.vehicle ||
      "panel repair";
    const subject = photoAskSubject(job.suburb);
    const body = buildPhotoAskEmail({
      customerName: job.customerName,
      suburb: job.suburb,
      service,
      notes: job.damageNotes,
    });
    let delivered = false;
    let reason = demo
      ? "demo — photo-ask draft queued, not emailed"
      : "photo-ask Gmail draft created — waiting for your send";
    if (!demo) {
      await createGmailDraft({
        to: photoTo,
        from: settings.businessEmail,
        subject,
        body,
        threadId: job.gmailThreadId ?? job.threadId,
      });
    }
    await prisma.emailDraft.create({
      data: {
        jobId: job.id,
        type: "photo_ask",
        subject,
        body,
        sentAt: null,
      },
    });
    await queueEvent({
      jobId: job.id,
      type: "photo_ask",
      subject,
      body,
      toEmail: photoTo,
      delivered: false,
      demo,
    });
    await prisma.job.update({
      where: { id: job.id },
      data: {
        photoAskSentAt: now,
        lastActivityAt: now,
      },
    });
    await syncJobGmailLabelById(job.id);
    queued.push({
      jobId: job.id,
      customerName: job.customerName,
      type: "photo_ask",
      delivered,
      reason,
    });
  }

  return queued;
}

export async function runAutomations(now = new Date()): Promise<AutomationRunResult> {
  const settings = await getSettings();
  const demo = isDemoMode();
  let inboxImported = 0;
  try {
    const { importEligibleInbox } = await import("./board-import");
    const inbox = await importEligibleInbox();
    inboxImported = inbox.imported;
  } catch {
    // Inbox import is best-effort; follow-ups still run.
  }
  const jobs = await prisma.job.findMany({ include: { photos: true } });
  const queued: AutomationRunResult["queued"] = [];

  for (const job of jobs) {
    if (followUpPhase(job, settings, now) === "pending") {
      const replyAt = await detectCustomerReply(job);
      if (replyAt) {
        await prisma.job.update({
          where: { id: job.id },
          data: { lastCustomerReplyAt: replyAt },
        });
        await touchJobActivity(job.id, replyAt);
        if (replyAt.getTime() >= (followUpClockStart(job)?.getTime() ?? 0)) {
          continue;
        }
      }
      const to = customerRecipientOrNull(job.customerEmail, settings.businessEmail);
      if (!to) continue;

      const subject = followUpSubject(job.vehicle);
      const body = buildFollowUpEmail(job.customerName);
      const result = await deliverAutomation({
        type: "follow_up",
        to,
        from: settings.businessEmail,
        subject,
        body,
        threadId: job.gmailThreadId ?? job.threadId,
      });

      const sentAt = new Date();
      await prisma.automationEvent.create({
        data: {
          jobId: job.id,
          type: "follow_up",
          subject,
          body,
          toEmail: to,
          delivered: result.delivered,
          demo,
          error: result.error,
        },
      });
      await prisma.job.update({
        where: { id: job.id },
        data: {
          followUpSentAt: sentAt,
          lastOutboundAt: sentAt,
          lastActivityAt: sentAt,
        },
      });
      await syncJobGmailLabelById(job.id);
      queued.push({
        jobId: job.id,
        customerName: job.customerName,
        type: "follow_up",
        delivered: result.delivered,
        reason: result.reason,
      });
      await maybeQueueAutomationSms({
        job,
        type: "follow_up",
        enabled: settings.autoSmsFollowUp,
        demo,
      });
    }

    queued.push(...(await processPhotoAndScope(job, settings, demo, now)));

    if (reviewAskPhase(job, settings, now) === "pending") {
      const to = customerRecipientOrNull(job.customerEmail, settings.businessEmail);
      if (!to) continue;
      const subject = reviewAskSubject();
      const body = buildReviewAskEmail(
        job.customerName,
        settings.googleReviewUrl,
      );
      const result = await deliverAutomation({
        type: "review_ask",
        to,
        from: settings.businessEmail,
        subject,
        body,
        threadId: job.gmailThreadId ?? job.threadId,
      });

      const sentAt = new Date();
      await prisma.automationEvent.create({
        data: {
          jobId: job.id,
          type: "review_ask",
          subject,
          body,
          toEmail: to,
          delivered: result.delivered,
          demo,
          error: result.error,
        },
      });
      await prisma.job.update({
        where: { id: job.id },
        data: {
          reviewAskSentAt: sentAt,
          lastOutboundAt: sentAt,
          lastActivityAt: sentAt,
        },
      });
      await syncJobGmailLabelById(job.id);
      queued.push({
        jobId: job.id,
        customerName: job.customerName,
        type: "review_ask",
        delivered: result.delivered,
        reason: result.reason,
      });
    }
  }

  return {
    demo,
    emailed: queued.some((item) => item.delivered),
    followUps: queued.filter((item) => item.type === "follow_up").length,
    reviewAsks: queued.filter((item) => item.type === "review_ask").length,
    photoAsks: queued.filter((item) => item.type === "photo_ask").length,
    declines: queued.filter((item) => item.type === "scope_decline").length,
    inboxImported,
    queued,
  };
}
