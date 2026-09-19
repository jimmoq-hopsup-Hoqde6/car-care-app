export interface ServiceRow {
  id: number;
  vehicle_id: number;
  type: string;
  performed_on: string;
  mileage: number;
  cost: number;
  notes: string;
  created_at: string;
}

interface IntervalRule {
  type: string;
  everyMiles: number;
  everyMonths: number;
}

/**
 * Standard maintenance intervals used to compute upcoming service reminders.
 * These are conservative, commonly recommended intervals.
 */
const RULES: IntervalRule[] = [
  { type: "Oil Change", everyMiles: 5000, everyMonths: 6 },
  { type: "Tire Rotation", everyMiles: 7500, everyMonths: 6 },
  { type: "Air Filter", everyMiles: 15000, everyMonths: 12 },
  { type: "Brake Pads", everyMiles: 40000, everyMonths: 36 },
];

export type ReminderStatus = "overdue" | "due-soon" | "ok";

export interface Reminder {
  type: string;
  status: ReminderStatus;
  dueAtMileage: number;
  milesRemaining: number;
  lastPerformedOn: string | null;
  lastMileage: number | null;
}

function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
}

export function computeReminders(
  currentMileage: number,
  services: ServiceRow[],
  now: Date = new Date()
): Reminder[] {
  return RULES.map((rule) => {
    const history = services
      .filter((s) => s.type === rule.type)
      .sort((a, b) => b.mileage - a.mileage);
    const last = history[0] ?? null;

    const baselineMileage = last ? last.mileage : 0;
    const dueAtMileage = baselineMileage + rule.everyMiles;
    const milesRemaining = dueAtMileage - currentMileage;

    let overdueByTime = false;
    if (last) {
      const performed = new Date(last.performed_on);
      if (!Number.isNaN(performed.getTime())) {
        overdueByTime = monthsBetween(performed, now) >= rule.everyMonths;
      }
    }

    let status: ReminderStatus = "ok";
    if (milesRemaining <= 0 || overdueByTime) {
      status = "overdue";
    } else if (milesRemaining <= rule.everyMiles * 0.15) {
      status = "due-soon";
    }

    return {
      type: rule.type,
      status,
      dueAtMileage,
      milesRemaining,
      lastPerformedOn: last ? last.performed_on : null,
      lastMileage: last ? last.mileage : null,
    };
  });
}
