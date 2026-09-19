import { JobStatus } from "@prisma/client";
import { listAvailableSlots } from "../src/lib/booking";
import { prisma } from "../src/lib/prisma";
import { recommendSlots } from "../src/lib/recommendations";

async function main() {
  const unread = await prisma.notification.count({
    where: { readAt: null, type: "booking_approval" },
  });
  if (unread < 2) {
    throw new Error(
      `Expected at least two unread booking-approval notifications, found ${unread}.`,
    );
  }

  const [openSlots, bookedJobs] = await Promise.all([
    listAvailableSlots(14),
    prisma.job.findMany({
      where: {
        status: { in: [JobStatus.BOOKED, JobStatus.DONE] },
        bookedStart: { not: null },
        id: { not: "job-john" },
      },
      select: {
        id: true,
        customerName: true,
        suburb: true,
        bookedStart: true,
        bookedEnd: true,
      },
    }),
  ]);

  const ranked = recommendSlots(
    "Glenelg",
    openSlots,
    bookedJobs.filter(
      (row): row is typeof row & { bookedStart: Date; bookedEnd: Date } =>
        Boolean(row.bookedStart && row.bookedEnd),
    ),
  );
  const recommended = ranked.filter((slot) => slot.recommended);
  if (recommended.length === 0) {
    throw new Error("Expected recommended Glenelg slots from nearby booked jobs.");
  }

  const reason = recommended
    .map((slot) => slot.recommendReason ?? "")
    .join(" | ");
  if (!/brighton|somerton park|glenelg/i.test(reason)) {
    throw new Error(`Expected a nearby-suburb reason, got: ${reason}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        unreadBookingApprovals: unread,
        recommended: recommended.map((slot) => ({
          day: slot.dayLabel,
          label: slot.label,
          reason: slot.recommendReason,
          score: slot.score,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
