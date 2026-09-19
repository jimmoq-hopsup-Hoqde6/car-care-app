import { differenceInCalendarDays } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { ADELAIDE_TZ } from "./constants";

export type DateLike = Date | string | null | undefined;

export function asActivityDate(value: DateLike): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function adelaideTime(date: Date) {
  return formatInTimeZone(date, ADELAIDE_TZ, "h:mm a")
    .replace(" AM", " am")
    .replace(" PM", " pm");
}

/** Human-friendly Adelaide local, always enough to see when the thread stopped. */
export function formatLastActivity(
  value: DateLike,
  now = new Date(),
  options?: { compact?: boolean },
): string {
  const date = asActivityDate(value);
  if (!date) return "—";

  const zoned = toZonedTime(date, ADELAIDE_TZ);
  const zonedNow = toZonedTime(now, ADELAIDE_TZ);
  const days = differenceInCalendarDays(zonedNow, zoned);
  const time = adelaideTime(date);

  if (days === 0) return `Today · ${time}`;
  if (days === 1) return `Yesterday · ${time}`;

  const sameYear = zoned.getFullYear() === zonedNow.getFullYear();
  if (options?.compact || days >= 7) {
    const dayPart = formatInTimeZone(
      date,
      ADELAIDE_TZ,
      sameYear ? "d MMM" : "d MMM yyyy",
    );
    return `${dayPart} · ${time}`;
  }

  return `${formatInTimeZone(date, ADELAIDE_TZ, "EEE d MMM")} · ${time}`;
}

export function activityMillis(value: DateLike, fallback?: DateLike): number {
  const date = asActivityDate(value) ?? asActivityDate(fallback);
  return date ? date.getTime() : 0;
}
