import { addDays, addHours } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { ADELAIDE_TZ } from "./constants";
import { getCalendar } from "./google";
import { formatAUD } from "./money";
import { firstName } from "./quote";
import { getSettings } from "./settings";
import type { TimeSlot } from "./slots";

export type { TimeSlot };

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function wallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  timeZone = ADELAIDE_TZ,
) {
  return fromZonedTime(
    `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`,
    timeZone,
  );
}

export function formatAdelaide(date: Date, pattern = "EEEE d MMMM, h:mm a") {
  return formatInTimeZone(date, ADELAIDE_TZ, pattern);
}

export async function listAvailableSlots(days = 14): Promise<TimeSlot[]> {
  const settings = await getSettings();
  const now = new Date();
  const zonedNow = toZonedTime(now, settings.timezone);
  const startHour = settings.workStartHour;
  const endHour = settings.workEndHour;
  const duration = settings.jobDurationHours;
  const lastStart = endHour - duration;

  const windowStart = now;
  const windowEnd = addDays(now, days);

  const busy = await loadBusyPeriods(windowStart, windowEnd, settings.timezone);

  const slots: TimeSlot[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const day = addDays(zonedNow, offset);
    const year = day.getFullYear();
    const month = day.getMonth() + 1;
    const date = day.getDate();
    const weekday = day.getDay();
    if (!settings.workDays.includes(weekday)) continue;

    for (let hour = startHour; hour <= lastStart; hour += 1) {
      const start = wallTimeToUtc(year, month, date, hour, 0, settings.timezone);
      const end = addHours(start, duration);
      if (start < now) continue;
      const overlaps = busy.some(
        (block) => start < block.end && end > block.start,
      );
      slots.push({
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        label: `${formatAdelaide(start, "h:mm a")} – ${formatAdelaide(end, "h:mm a")}`,
        dayLabel: formatAdelaide(start, "EEEE d MMMM"),
        busy: overlaps,
      });
    }
  }

  return slots;
}

async function loadBusyPeriods(
  timeMin: Date,
  timeMax: Date,
  timeZone: string,
): Promise<{ start: Date; end: Date }[]> {
  const calendar = await getCalendar();
  if (!calendar) {
    return demoBusyPeriods(timeMin);
  }

  const result = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone,
      items: [{ id: "primary" }],
    },
  });

  const calBusy = result.data.calendars?.primary?.busy ?? [];
  return calBusy
    .filter((block) => block.start && block.end)
    .map((block) => ({
      start: new Date(block.start as string),
      end: new Date(block.end as string),
    }));
}

function demoBusyPeriods(from: Date) {
  const zoned = toZonedTime(from, ADELAIDE_TZ);
  const periods: { start: Date; end: Date }[] = [];
  for (let offset = 0; offset < 14; offset += 1) {
    const day = addDays(zoned, offset);
    const weekday = day.getDay();
    if (weekday === 1) {
      periods.push({
        start: wallTimeToUtc(
          day.getFullYear(),
          day.getMonth() + 1,
          day.getDate(),
          8,
        ),
        end: wallTimeToUtc(
          day.getFullYear(),
          day.getMonth() + 1,
          day.getDate(),
          11,
        ),
      });
    }
    if (weekday === 3) {
      periods.push({
        start: wallTimeToUtc(
          day.getFullYear(),
          day.getMonth() + 1,
          day.getDate(),
          13,
        ),
        end: wallTimeToUtc(
          day.getFullYear(),
          day.getMonth() + 1,
          day.getDate(),
          16,
        ),
      });
    }
  }
  return periods;
}

export function jobEventTitle(job: {
  customerName: string;
  vehicle?: string | null;
  suburb?: string | null;
}) {
  const vehicleShort = (job.vehicle ?? "vehicle")
    .replace(/\s+—\s+/g, " ")
    .trim();
  return `Job — ${job.customerName} — ${vehicleShort} — ${job.suburb ?? "Adelaide"}`;
}

export function jobEventDescription(job: {
  quoteAmount?: number | null;
  vehicle?: string | null;
  damageNotes?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
}) {
  const lines = [
    job.quoteAmount != null ? `Quote total: ${formatAUD(job.quoteAmount)}` : null,
    job.vehicle ? `Vehicle: ${job.vehicle}` : null,
    job.damageNotes ? `Notes: ${job.damageNotes}` : null,
    job.customerEmail ? `Email: ${job.customerEmail}` : null,
    job.customerPhone ? `Phone: ${job.customerPhone}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

export function buildConfirmationEmail(job: {
  customerName: string;
  address?: string | null;
  suburb?: string | null;
  bookedStart: Date;
  bookedEnd: Date;
}) {
  const when = `${formatAdelaide(job.bookedStart, "EEEE d MMMM yyyy, h:mm a")} – ${formatAdelaide(job.bookedEnd, "h:mm a")}`;
  const where = job.address || job.suburb || "the address we discussed";

  return `Hi ${firstName(job.customerName)},

You're booked in for ${when} at ${where}.

Please make sure I have a suitable off-street location, access to a power point, and adequate natural light.

Kind regards,
Marcel Kuhn
Mobile Car Scratch Repair Adelaide`;
}

export function confirmationSubject(job: {
  suburb?: string | null;
  bookedStart: Date;
}) {
  return `Booking confirmed — ${formatAdelaide(job.bookedStart, "EEEE d MMMM")}${job.suburb ? `, ${job.suburb}` : ""}`;
}

export async function createCalendarEvent(input: {
  title: string;
  location?: string | null;
  description: string;
  start: Date;
  end: Date;
  timezone: string;
}) {
  const calendar = await getCalendar();
  if (!calendar) return `demo-event-${Date.now()}`;

  const result = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: input.title,
      location: input.location ?? undefined,
      description: input.description,
      start: {
        dateTime: input.start.toISOString(),
        timeZone: input.timezone,
      },
      end: {
        dateTime: input.end.toISOString(),
        timeZone: input.timezone,
      },
    },
  });

  return result.data.id ?? null;
}
