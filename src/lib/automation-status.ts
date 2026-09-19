import type { Job } from "@prisma/client";

export type AutomationPhase = "n/a" | "waiting" | "pending" | "sent" | "skipped";

export type AutomationSettings = {
  followUpDays: number;
  reviewAskDaysAfterJob: number;
};

type DateLike = Date | string | null | undefined;

function asDate(value: DateLike): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function hoursSince(from: DateLike, now = new Date()) {
  const date = asDate(from);
  if (!date) return null;
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60);
}

export function isAtLeastDaysAgo(from: DateLike, days: number, now = new Date()) {
  const date = asDate(from);
  if (!date) return false;
  return now.getTime() >= date.getTime() + days * 24 * 60 * 60 * 1000;
}

export function followUpClockStart(
  job: Pick<Job, "lastOutboundAt" | "quoteSentAt" | "awaitingSince" | "updatedAt">,
) {
  return (
    asDate(job.lastOutboundAt) ??
    asDate(job.quoteSentAt) ??
    asDate(job.awaitingSince) ??
    asDate(job.updatedAt)
  );
}

export function followUpPhase(
  job: Pick<
    Job,
    | "status"
    | "lastOutboundAt"
    | "quoteSentAt"
    | "awaitingSince"
    | "followUpSentAt"
    | "followUpSkippedAt"
    | "lastCustomerReplyAt"
    | "updatedAt"
  >,
  settings: AutomationSettings,
  now = new Date(),
): AutomationPhase {
  if (asDate(job.followUpSkippedAt)) return "skipped";
  if (asDate(job.followUpSentAt)) return "sent";
  if (job.status !== "AWAITING_CUSTOMER") return "n/a";
  const start = followUpClockStart(job);
  if (!start) return "waiting";
  const replyAt = asDate(job.lastCustomerReplyAt);
  if (replyAt && replyAt.getTime() >= start.getTime()) {
    return "n/a";
  }
  return isAtLeastDaysAgo(start, settings.followUpDays, now)
    ? "pending"
    : "waiting";
}

export function reviewAskPhase(
  job: Pick<
    Job,
    "status" | "completedAt" | "reviewAskSentAt" | "reviewAskSkippedAt"
  >,
  settings: AutomationSettings,
  now = new Date(),
): AutomationPhase {
  if (asDate(job.reviewAskSkippedAt)) return "skipped";
  if (asDate(job.reviewAskSentAt)) return "sent";
  if (job.status !== "DONE") return "n/a";
  if (!asDate(job.completedAt)) return "waiting";
  return isAtLeastDaysAgo(job.completedAt, settings.reviewAskDaysAfterJob, now)
    ? "pending"
    : "waiting";
}

export const PHASE_LABELS: Record<AutomationPhase, string> = {
  "n/a": "Not needed",
  waiting: "Waiting",
  pending: "Pending",
  sent: "Sent",
  skipped: "Skipped",
};
