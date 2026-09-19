import { JobStatus } from "@prisma/client";
import {
  buildConfirmationEmail,
  jobEventDescription,
  listAvailableSlots,
} from "../src/lib/booking";
import {
  forgottenReadyToBook,
  isReadyToBookNoDate,
  looksLikeBookingConfirmation,
} from "../src/lib/booking-ops";
import { OWNER_MOBILE } from "../src/lib/constants";
import { prisma } from "../src/lib/prisma";
import { recommendSlots } from "../src/lib/recommendations";

async function main() {
  if (
    !looksLikeBookingConfirmation(
      "Yes Saturday morning works. Book me in. Address is 14 Main North Road, Prospect.",
    )
  ) {
    throw new Error("Darren-style Saturday confirm must look like a booking confirmation");
  }
  if (looksLikeBookingConfirmation("Thanks Marcel. I'll check with my wife.")) {
    throw new Error("A maybe-later quote reply must not look like a booking confirmation");
  }

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

  const start = new Date("2026-09-24T01:30:00.000Z");
  const end = new Date("2026-09-24T04:30:00.000Z");
  const confirmation = buildConfirmationEmail({
    customerName: "John Hale",
    address: "41 Jetty Road, Glenelg SA 5045",
    suburb: "Glenelg",
    bookedStart: start,
    bookedEnd: end,
  });
  if (!confirmation.startsWith("Hi John,")) {
    throw new Error("Confirmation must greet Hi John,");
  }
  if (!confirmation.includes("off-street parking")) {
    throw new Error("Confirmation must ask for off-street parking.");
  }
  if (!confirmation.includes("Marcel Kuhn")) {
    throw new Error("Confirmation must sign off Marcel Kuhn.");
  }

  const ready = await prisma.job.findMany({
    where: { status: JobStatus.READY_TO_BOOK },
  });
  const forgotten = forgottenReadyToBook(ready);
  if (forgotten.length < 2) {
    throw new Error("Expected John and Mia as ready-to-book with no date.");
  }
  if (!forgotten.every(isReadyToBookNoDate)) {
    throw new Error("Forgotten ready-to-book jobs must have no calendar event.");
  }

  const eventBody = jobEventDescription({
    customerName: "John Hale",
    customerPhone: "0421 990 221",
    quoteAmount: 520,
    address: "41 Jetty Road, Glenelg SA 5045",
    suburb: "Glenelg",
  });
  if (!eventBody.includes("Customer: John Hale")) {
    throw new Error("Calendar event must include the customer name.");
  }
  if (!eventBody.includes("Phone: 0421 990 221")) {
    throw new Error("Calendar event must include the phone.");
  }
  if (!eventBody.includes("Quote total:")) {
    throw new Error("Calendar event must include the quote total.");
  }
  if (!eventBody.includes("41 Jetty Road")) {
    throw new Error("Calendar event must include the address.");
  }
  if (OWNER_MOBILE !== "0435222221") {
    throw new Error(`Expected owner mobile 0435222221, got ${OWNER_MOBILE}`);
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
