import type { Job } from "@prisma/client";

export type AutomationPhase = "n/a" | "waiting" | "pending" | "sent" | "skipped";

export type AutomationSettings = {
  followUpDays: number;
  reviewAskDaysAfterJob: number;
};

export function hoursSince(from: Date | null | undefined, now = new Date()) {
  if (!from) return null;
  return (now.getTime() - from.getTime()) / (1000 * 60 * 60);
}

export function isAtLeastDaysAgo(
  from: Date | null | undefined,
  days: number,
  now = new Date(),
) {
  if (!from) return false;
  return now.getTime() >= from.getTime() + days * 24 * 60 * 60 * 1000;
}

export function followUpClockStart(
  job: Pick<Job, "lastOutboundAt" | "quoteSentAt" | "awaitingSince" | "updatedAt">,
) {
  return job.lastOutboundAt ?? job.quoteSentAt ?? job.awaitingSince ?? job.updatedAt ?? null;
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
  if (job.followUpSkippedAt) return "skipped";
  if (job.followUpSentAt) return "sent";
  if (job.status !== "AWAITING_CUSTOMER") return "n/a";
  const start = followUpClockStart(job);
  if (!start) return "waiting";
  if (
    job.lastCustomerReplyAt &&
    job.lastCustomerReplyAt.getTime() >= start.getTime()
  ) {
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
  if (job.reviewAskSkippedAt) return "skipped";
  if (job.reviewAskSentAt) return "sent";
  if (job.status !== "DONE") return "n/a";
  if (!job.completedAt) return "waiting";
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
