import { differenceInCalendarDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ADELAIDE_TZ } from "./constants";
import { asActivityDate, type DateLike } from "./activity";

type BookingJob = {
  status: string;
  bookedStart?: Date | null;
  calendarEventId?: string | null;
  lastCustomerReplyAt?: Date | null;
  lastActivityAt?: Date | null;
  updatedAt?: Date | null;
  damageNotes?: string | null;
};

/** Accepted / “when can you come?” with no Calendar event yet. */
export function isReadyToBookNoDate(job: BookingJob) {
  return (
    job.status === "READY_TO_BOOK" &&
    !job.bookedStart &&
    !job.calendarEventId
  );
}

export function lastCustomerMessageAt(job: BookingJob): Date | null {
  return (
    asActivityDate(job.lastCustomerReplyAt) ??
    asActivityDate(job.lastActivityAt) ??
    asActivityDate(job.updatedAt as DateLike)
  );
}

/** Compact wait since the last customer message, Adelaide calendar days. */
export function waitingSinceLabel(job: BookingJob, now = new Date()) {
  const start = lastCustomerMessageAt(job);
  if (!start) return "Waiting";
  const zoned = toZonedTime(start, ADELAIDE_TZ);
  const zonedNow = toZonedTime(now, ADELAIDE_TZ);
  const days = differenceInCalendarDays(zonedNow, zoned);
  if (days <= 0) {
    const hours = (now.getTime() - start.getTime()) / 36e5;
    if (hours < 1) return "Waiting now";
    return `Waiting ${Math.max(1, Math.round(hours))}h`;
  }
  return `Waiting ${days}d`;
}

/** They already named a day/time vs still asking when Marcel can come. */
export function customerNamedATime(job: Pick<BookingJob, "damageNotes">) {
  const hay = (job.damageNotes ?? "").toLowerCase();
  return /\b(yes,?\s+(mon|tue|wed|thu|fri|sat|sun)|yes,?\s+wednesday|yes,?\s+thursday|afternoon is fine|morning is fine|that works|sounds good — book|lock in)\b/.test(
    hay,
  );
}

export function bookingNextCta(job: Pick<BookingJob, "damageNotes">) {
  return customerNamedATime(job) ? "Confirm booking" : "Offer dates";
}

export function forgottenReadyToBook<T extends BookingJob>(jobs: T[]) {
  return [...jobs]
    .filter(isReadyToBookNoDate)
    .sort((a, b) => {
      const aTime = lastCustomerMessageAt(a)?.getTime() ?? 0;
      const bTime = lastCustomerMessageAt(b)?.getTime() ?? 0;
      return aTime - bTime;
    });
}

/** Awaiting-customer jobs with no update for 2+ days (visual stall, not a send). */
export function isStalledAwaiting(job: BookingJob, now = new Date()) {
  if (job.status !== "AWAITING_CUSTOMER") return false;
  const start = lastCustomerMessageAt(job);
  if (!start) return false;
  return now.getTime() - start.getTime() >= 48 * 36e5;
}

/**
 * Pipedrive-style urgency: forgotten ready-to-book first, then stalled
 * awaiting-customer, then the rest. Lower is more urgent.
 */
export function urgencyRank(job: BookingJob, now = new Date()) {
  if (isReadyToBookNoDate(job)) return 0;
  if (isStalledAwaiting(job, now)) return 1;
  return 2;
}

export function isRotting(job: BookingJob, now = new Date()) {
  return urgencyRank(job, now) < 2;
}
