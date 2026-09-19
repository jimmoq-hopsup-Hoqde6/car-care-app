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
import { parseRepairItems } from "./quote";
import { detectOutOfScope } from "./scope";
import { prisma } from "./prisma";
import { getSettings } from "./settings";

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
  queued: Array<{
    jobId: string;
    customerName: string;
    type: AutomationType;
    delivered: boolean;
    reason: string;
  }>;
};

function assertAutoSendType(type: AutomationType) {
  if (type === "follow_up" || type === "review_ask" || type === "photo_ask") {
    return;
  }
  if (type === "scope_decline") {
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
      data: { outOfScope: true },
    });
  }

  if (outOfScope && !job.declinedAt && job.customerEmail) {
    const subject = scopeDeclineSubject();
    const body = buildScopeDeclineEmail(job.customerName);
    let delivered = false;
    let reason = "decline draft saved — not sent";
    let error: string | undefined;
    if (settings.autoDeclineOutOfScope) {
      const result = await deliverAutomation({
        type: "scope_decline",
        to: job.customerEmail,
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
        to: job.customerEmail,
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
      toEmail: job.customerEmail,
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

  const needsPhotoAsk =
    settings.autoAskPhotos &&
    !outOfScope &&
    !job.photoAskSentAt &&
    job.photos.length === 0 &&
    job.status === "NEEDS_QUOTE" &&
    Boolean(job.customerEmail);

  if (needsPhotoAsk && job.customerEmail) {
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
    const result = await deliverAutomation({
      type: "photo_ask",
      to: job.customerEmail,
      from: settings.businessEmail,
      subject,
      body,
      threadId: job.gmailThreadId ?? job.threadId,
    });
    await prisma.emailDraft.create({
      data: {
        jobId: job.id,
        type: "photo_ask",
        subject,
        body,
        sentAt: result.delivered ? now : null,
      },
    });
    await queueEvent({
      jobId: job.id,
      type: "photo_ask",
      subject,
      body,
      toEmail: job.customerEmail,
      delivered: result.delivered,
      demo,
      error: result.error,
    });
    await prisma.job.update({
      where: { id: job.id },
      data: {
        photoAskSentAt: now,
        lastOutboundAt: now,
        lastActivityAt: now,
      },
    });
    await syncJobGmailLabelById(job.id);
    queued.push({
      jobId: job.id,
      customerName: job.customerName,
      type: "photo_ask",
      delivered: result.delivered,
      reason: result.reason,
    });
  }

  return queued;
}

export async function runAutomations(now = new Date()): Promise<AutomationRunResult> {
  const settings = await getSettings();
  const demo = isDemoMode();
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
      if (!job.customerEmail) continue;

      const subject = followUpSubject(job.vehicle);
      const body = buildFollowUpEmail(job.customerName);
      const result = await deliverAutomation({
        type: "follow_up",
        to: job.customerEmail,
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
          toEmail: job.customerEmail,
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
    }

    queued.push(...(await processPhotoAndScope(job, settings, demo, now)));

    if (reviewAskPhase(job, settings, now) === "pending") {
      if (!job.customerEmail) continue;
      const subject = reviewAskSubject();
      const body = buildReviewAskEmail(
        job.customerName,
        settings.googleReviewUrl,
      );
      const result = await deliverAutomation({
        type: "review_ask",
        to: job.customerEmail,
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
          toEmail: job.customerEmail,
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
    queued,
  };
}
