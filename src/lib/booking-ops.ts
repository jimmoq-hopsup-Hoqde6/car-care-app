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

const WEEKDAY =
  /\b(mon(day)?|tue(s(day)?)?|wed(nesday)?|thu(r(s(day)?)?)?|fri(day)?|sat(urday)?|sun(day)?)\b/i;
const NAMED_TIME =
  /\b(\d{1,2}(:\d{2})?\s?(am|pm)|morning|afternoon|evening|after\s+\d{1,2})\b/i;
const CONFIRM_PHRASE =
  /\b(yes|yep|yeah|that works|that day works|that date works|sounds good|go ahead|happy to|lock in|please book|book me(\s+in)?|book in|see you then|works for me|fine with me|address (is|provided|:))\b/i;
const BOOKING_ASK =
  /\b(when (are you|can you)|can we book|when can you come|available (next|this)|next week after)\b/i;

/** Customer picked a day/time or accepted a booking offer. */
export function looksLikeBookingConfirmation(text?: string | null) {
  const hay = (text ?? "").toLowerCase();
  if (!hay.trim()) return false;
  if (/\b(that day works|that date works|book me(\s+in)?|please book|lock (it|me|that)?\s*in)\b/.test(hay)) {
    return true;
  }
  if (WEEKDAY.test(hay) && CONFIRM_PHRASE.test(hay)) return true;
  if (WEEKDAY.test(hay) && NAMED_TIME.test(hay) && /\b(yes|works|fine|book|confirm)\b/.test(hay)) {
    return true;
  }
  if (/\baddress\s+(is|provided|:)\b/.test(hay) && (WEEKDAY.test(hay) || CONFIRM_PHRASE.test(hay))) {
    return true;
  }
  return false;
}

/** They want a booking but have not locked a day yet. */
export function looksLikeBookingRequest(text?: string | null) {
  const hay = (text ?? "").toLowerCase();
  if (!hay.trim()) return false;
  if (looksLikeBookingConfirmation(hay)) return false;
  return BOOKING_ASK.test(hay) || /\b(book me|can you book|happy with the quote)\b/.test(hay);
}

/** They already named a day/time vs still asking when Marcel can come. */
export function customerNamedATime(job: Pick<BookingJob, "damageNotes">) {
  const hay = job.damageNotes ?? "";
  if (!hay.trim()) return false;
  if (/\b(that day works|that date works|yes,?\s+(mon|tue(s)?|wed|thu(rs)?|fri|sat|sun))\b/i.test(hay)) {
    return true;
  }
  return WEEKDAY.test(hay) && (CONFIRM_PHRASE.test(hay) || NAMED_TIME.test(hay));
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
