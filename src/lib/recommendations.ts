import { formatAdelaide } from "./booking";
import { clustersAreAdjacent, sameSuburb, suburbCluster } from "./areas";
import type { TimeSlot } from "./slots";

export type BookedJobRef = {
  id: string;
  customerName: string;
  suburb?: string | null;
  bookedStart: Date;
  bookedEnd: Date;
};

export type RankedSlot = TimeSlot & {
  recommended: boolean;
  recommendReason?: string;
  recommendRank?: number;
  score: number;
};

function partOfDay(date: Date) {
  const hour = Number(formatAdelaide(date, "H"));
  return hour < 12 ? "morning" : "afternoon";
}

function sameAdelaideDay(a: Date, b: Date) {
  return formatAdelaide(a, "yyyy-MM-dd") === formatAdelaide(b, "yyyy-MM-dd");
}

function scoreAgainstBooked(
  jobSuburb: string | null | undefined,
  slot: TimeSlot,
  booked: BookedJobRef,
): { score: number; reason: string } | null {
  const start = new Date(slot.startIso);
  if (!sameAdelaideDay(start, booked.bookedStart)) return null;

  const slotPart = partOfDay(start);
  const bookedPart = partOfDay(booked.bookedStart);
  const after = start.getTime() >= booked.bookedEnd.getTime();
  const jobCluster = suburbCluster(jobSuburb);
  const bookedCluster = suburbCluster(booked.suburb);

  if (sameSuburb(jobSuburb, booked.suburb)) {
    if (after) {
      return {
        score: 110,
        reason: `Nearest free slot after ${booked.suburb}`,
      };
    }
    if (slotPart === bookedPart) {
      return {
        score: 100,
        reason: `Same ${slotPart} as your ${booked.suburb} job`,
      };
    }
    return {
      score: 90,
      reason: `Same day as your ${booked.suburb} job`,
    };
  }

  if (jobCluster !== "unknown" && jobCluster === bookedCluster) {
    if (after) {
      return {
        score: 80,
        reason: `Nearest free slot after ${booked.suburb}`,
      };
    }
    return {
      score: 70,
      reason: `Same ${slotPart} as your ${booked.suburb} job`,
    };
  }

  if (clustersAreAdjacent(jobCluster, bookedCluster)) {
    if (after) {
      return {
        score: 50,
        reason: `Nearest free slot after ${booked.suburb}`,
      };
    }
    return {
      score: 40,
      reason: `Same day as a nearby ${booked.suburb} job`,
    };
  }

  return null;
}

export function recommendSlots(
  jobSuburb: string | null | undefined,
  slots: TimeSlot[],
  bookedJobs: BookedJobRef[],
  limit = 3,
): RankedSlot[] {
  const free = slots.filter((slot) => !slot.busy);
  const ranked: RankedSlot[] = free.map((slot, index) => {
    let best: { score: number; reason: string } = {
      score: Math.max(1, 8 - index),
      reason: "Open weekday slot",
    };
    for (const booked of bookedJobs) {
      const match = scoreAgainstBooked(jobSuburb, slot, booked);
      if (match && match.score > best.score) best = match;
    }
    return { ...slot, recommended: false, score: best.score, recommendReason: best.reason };
  });

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.startIso.localeCompare(b.startIso);
  });

  return ranked.map((slot, index) => ({
    ...slot,
    recommended: index < limit && slot.score >= 40,
    recommendRank: index < limit ? index + 1 : undefined,
    recommendReason:
      index < limit ? slot.recommendReason : undefined,
  }));
}
