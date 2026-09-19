import { addDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { PrismaClient, JobStatus } from "@prisma/client";
import { ADELAIDE_TZ, DEFAULT_GOOGLE_REVIEW_URL } from "../src/lib/constants";

const prisma = new PrismaClient();

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Wall-clock Adelaide time, `daysBack` calendar days before today. */
function adelaideAt(daysBack: number, hour: number, minute: number) {
  const zoned = toZonedTime(new Date(), ADELAIDE_TZ);
  const day = addDays(zoned, -daysBack);
  return fromZonedTime(
    `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(hour)}:${pad(minute)}:00`,
    ADELAIDE_TZ,
  );
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function nextAdelaideWeekday(weekday: number, hour: number, durationHours = 3) {
  const zoned = toZonedTime(new Date(), ADELAIDE_TZ);
  for (let offset = 1; offset <= 14; offset += 1) {
    const day = addDays(zoned, offset);
    if (day.getDay() !== weekday) continue;
    const start = fromZonedTime(
      `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(hour)}:00:00`,
      ADELAIDE_TZ,
    );
    return {
      start,
      end: new Date(start.getTime() + durationHours * 60 * 60 * 1000),
    };
  }
  const fallback = new Date();
  return { start: fallback, end: new Date(fallback.getTime() + durationHours * 3600000) };
}

async function main() {
  const reviewUrl =
    process.env.GOOGLE_REVIEW_URL?.trim() || DEFAULT_GOOGLE_REVIEW_URL;
  const existingSettings = await prisma.appSetting.findUnique({
    where: { id: "default" },
  });
  const storedUrl = existingSettings?.googleReviewUrl ?? "";
  const replacePlaceholder =
    !storedUrl ||
    storedUrl.includes("PLACEHOLDER") ||
    storedUrl.includes("YOUR-REVIEW-LINK");

  await prisma.appSetting.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      followUpDays: Number(process.env.FOLLOW_UP_DAYS || 2),
      reviewAskDaysAfterJob: Number(process.env.REVIEW_ASK_DAYS_AFTER_JOB || 1),
      googleReviewUrl: reviewUrl,
      autoAskPhotos: true,
    },
    update: replacePlaceholder ? { googleReviewUrl: reviewUrl } : {},
  });

  const bands = [
    { id: "band-minor", name: "Minor scratch", sortOrder: 1 },
    { id: "band-bumper", name: "Bumper scratch", sortOrder: 2 },
    { id: "band-multi", name: "Multi-panel", sortOrder: 3 },
  ];

  for (const band of bands) {
    await prisma.priceBand.upsert({
      where: { id: band.id },
      create: band,
      update: {},
    });
  }

  const stalledSince = daysAgo(3);
  const completedSince = daysAgo(2);

  const jobs = [
    {
      id: "job-jenny",
      customerName: "Jenny Gwynne",
      customerEmail: "jenny.gwynne@example.com",
      customerPhone: "0408 112 334",
      vehicle: "BMW 320i — front bumper",
      suburb: "Crafers",
      address: "8 Piccadilly Road, Crafers SA 5152",
      damageNotes:
        "Website form: car park scrape across the front bumper. Off-street driveway. Photos attached.",
      repairItems: JSON.stringify(["Front bumper scratch and scuff"]),
      channel: "website",
      threadId: "demo-thread-jenny",
      status: JobStatus.NEEDS_QUOTE,
      quoteAmount: null as number | null,
      isDemo: true,
      lastActivityAt: adelaideAt(0, 9, 14),
      photos: [
        { url: "/demo/jenny-bumper.svg", filename: "bmw-bumper.jpg" },
        { url: "/demo/jenny-bumper-close.svg", filename: "bmw-bumper-close.jpg" },
      ],
    },
    {
      id: "job-nathan",
      customerName: "Nathan Crowe",
      customerEmail: "nathan.crowe@example.com",
      customerPhone: "0413 556 778",
      vehicle: "Mitsubishi Outlander",
      suburb: "Unley",
      address: "22 Hughes Street, Unley SA 5061",
      damageNotes:
        "Long scratch along the driver door and a scuff on the side mirror. Asked for a quote by email.",
      repairItems: JSON.stringify([
        "Driver door scratch",
        "Side mirror scuff",
      ]),
      channel: "email",
      threadId: "demo-thread-nathan",
      status: JobStatus.AWAITING_CUSTOMER,
      quoteAmount: 380,
      isDemo: true,
      lastOutboundAt: stalledSince,
      quoteSentAt: stalledSince,
      awaitingSince: stalledSince,
      lastActivityAt: adelaideAt(3, 10, 20),
      photos: [
        { url: "/demo/nathan-door.svg", filename: "outlander-door.jpg" },
      ],
    },
    {
      id: "job-john",
      customerName: "John Hale",
      customerEmail: "john.hale@example.com",
      customerPhone: "0421 990 221",
      vehicle: "Honda CR-V — rear quarter",
      suburb: "Glenelg",
      address: "41 Jetty Road, Glenelg SA 5045",
      damageNotes:
        "Rear quarter panel scratch, passenger side. Happy with the quote — wants to lock in a day.",
      repairItems: JSON.stringify(["Rear quarter panel scratch"]),
      channel: "email",
      threadId: "demo-thread-john",
      status: JobStatus.READY_TO_BOOK,
      quoteAmount: 520,
      isDemo: true,
      lastCustomerReplyAt: adelaideAt(1, 16, 32),
      lastActivityAt: adelaideAt(1, 16, 32),
      photos: [
        { url: "/demo/john-quarter.svg", filename: "crv-quarter.jpg" },
      ],
    },
    {
      id: "job-priya",
      customerName: "Priya Nair",
      customerEmail: "priya.nair@example.com",
      customerPhone: "0432 118 440",
      vehicle: "Mazda 3 — door ding",
      suburb: "Norwood",
      address: "15 The Parade, Norwood SA 5067",
      damageNotes: "Door ding repaired last week. Marked done for the review ask demo.",
      repairItems: JSON.stringify(["Driver door ding"]),
      channel: "email",
      threadId: "demo-thread-priya",
      status: JobStatus.DONE,
      quoteAmount: 260,
      isDemo: true,
      completedAt: completedSince,
      lastOutboundAt: daysAgo(5),
      lastActivityAt: adelaideAt(2, 15, 40),
      photos: [{ url: "/demo/priya-door.svg", filename: "mazda-door-ding.jpg" }],
    },
    {
      id: "job-mia",
      customerName: "Mia Chen",
      customerEmail: "mia.chen@example.com",
      customerPhone: "0407 331 220",
      vehicle: "Toyota Corolla — rear bumper",
      suburb: "Goodwood",
      address: "18 Albert Street, Goodwood SA 5034",
      damageNotes:
        "Happy with the quote — asked to book next week after 1pm. Seeded so the alerts list has a second booking-approval note.",
      repairItems: JSON.stringify(["Rear bumper scratch"]),
      channel: "email",
      threadId: "demo-thread-mia",
      status: JobStatus.READY_TO_BOOK,
      quoteAmount: 340,
      isDemo: true,
      lastCustomerReplyAt: adelaideAt(2, 13, 18),
      lastActivityAt: adelaideAt(2, 13, 18),
      photos: [{ url: "/demo/mia-bumper.svg", filename: "corolla-bumper.jpg" }],
    },
    {
      id: "job-jamie",
      customerName: "Jamie Collis",
      customerEmail: "jamie_collis@outlook.com",
      customerPhone: "0468923953",
      vehicle: "Panel repair — bonnet",
      suburb: "Paradise",
      address: "12 Silkes Road, Paradise SA 5075",
      damageNotes:
        "Website form: scratches on bonnet, ceramic coating has been applied prior to damage. Form showed: No photos uploaded. Service: Panel Repair.",
      repairItems: JSON.stringify(["Scratches on bonnet"]),
      channel: "website",
      threadId: "demo-thread-jamie",
      status: JobStatus.NEEDS_QUOTE,
      quoteAmount: null as number | null,
      isDemo: true,
      outOfScope: true,
      lastActivityAt: adelaideAt(0, 8, 40),
      photos: [] as { url: string; filename: string }[],
    },
    {
      id: "job-sam",
      customerName: "Sam Vella",
      customerEmail: "sam.vella@example.com",
      customerPhone: "0412 334 880",
      vehicle: "Subaru Forester — driver door",
      suburb: "Norwood",
      address: "40 The Parade, Norwood SA 5067",
      damageNotes:
        "Website form: long scratch on the driver door. No photos uploaded.",
      repairItems: JSON.stringify(["Driver door scratch"]),
      channel: "website",
      threadId: "demo-thread-sam",
      status: JobStatus.NEEDS_QUOTE,
      quoteAmount: null as number | null,
      isDemo: true,
      outOfScope: false,
      lastActivityAt: adelaideAt(0, 8, 55),
      photos: [] as { url: string; filename: string }[],
    },
  ];

  for (const job of jobs) {
    const { photos, ...data } = job;
    const existing = await prisma.job.findUnique({ where: { id: job.id } });
    if (!existing) {
      await prisma.job.create({
        data: {
          ...data,
          photos: photos.length ? { create: photos } : undefined,
        },
      });
      continue;
    }

    if (job.id === "job-nathan" && !existing.followUpSentAt) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          lastOutboundAt: existing.lastOutboundAt ?? stalledSince,
          quoteSentAt: existing.quoteSentAt ?? stalledSince,
          awaitingSince: existing.awaitingSince ?? stalledSince,
          lastActivityAt: adelaideAt(3, 10, 20),
          status: JobStatus.AWAITING_CUSTOMER,
        },
      });
    }
    if (job.id === "job-priya" && !existing.reviewAskSentAt) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.DONE,
          completedAt: existing.completedAt ?? completedSince,
          lastActivityAt: adelaideAt(2, 15, 40),
        },
      });
    }
    if (job.id === "job-john") {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.READY_TO_BOOK,
          bookedStart: null,
          bookedEnd: null,
          calendarEventId: null,
          suburb: "Glenelg",
          lastCustomerReplyAt: adelaideAt(1, 16, 32),
          lastActivityAt: adelaideAt(1, 16, 32),
        },
      });
    }
    if (job.id === "job-mia") {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.READY_TO_BOOK,
          bookedStart: null,
          bookedEnd: null,
          calendarEventId: null,
          suburb: "Goodwood",
          quoteAmount: existing.quoteAmount ?? 340,
          lastCustomerReplyAt: adelaideAt(2, 13, 18),
          lastActivityAt: adelaideAt(2, 13, 18),
        },
      });
    }
    if (job.id === "job-jenny") {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.NEEDS_QUOTE,
          lastActivityAt: adelaideAt(0, 9, 14),
        },
      });
    }
    if (job.id === "job-jamie") {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          customerName: "Jamie Collis",
          customerEmail: "jamie_collis@outlook.com",
          customerPhone: "0468923953",
          vehicle: "Panel repair — bonnet",
          suburb: "Paradise",
          damageNotes:
            "Website form: scratches on bonnet, ceramic coating has been applied prior to damage. Form showed: No photos uploaded. Service: Panel Repair.",
          repairItems: JSON.stringify(["Scratches on bonnet"]),
          status: JobStatus.NEEDS_QUOTE,
          outOfScope: true,
          declinedAt: null,
          photoAskSentAt: null,
          lastActivityAt: adelaideAt(0, 8, 40),
        },
      });
      await prisma.automationEvent.deleteMany({
        where: { jobId: "job-jamie", type: { in: ["scope_decline", "photo_ask"] } },
      });
      await prisma.emailDraft.deleteMany({
        where: { jobId: "job-jamie", type: { in: ["scope_decline", "photo_ask"] } },
      });
      await prisma.photo.deleteMany({ where: { jobId: "job-jamie" } });
    }
    if (job.id === "job-sam") {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.NEEDS_QUOTE,
          outOfScope: false,
          declinedAt: null,
          photoAskSentAt: null,
          lastActivityAt: adelaideAt(0, 8, 55),
        },
      });
      await prisma.automationEvent.deleteMany({
        where: { jobId: "job-sam", type: { in: ["scope_decline", "photo_ask"] } },
      });
      await prisma.emailDraft.deleteMany({
        where: { jobId: "job-sam", type: { in: ["scope_decline", "photo_ask"] } },
      });
    }
  }

  const tuesday = nextAdelaideWeekday(2, 8);
  const wednesday = nextAdelaideWeekday(3, 8);
  const thursday = nextAdelaideWeekday(4, 8);

  const nearbyBooked = [
    {
      id: "job-liam",
      customerName: "Liam Walsh",
      customerEmail: "liam.walsh@example.com",
      customerPhone: "0401 223 889",
      vehicle: "Toyota HiLux — tailgate",
      suburb: "Stirling",
      address: "4 Mount Barker Road, Stirling SA 5152",
      damageNotes: "Seeded booked hills job so Crafers recommendations have a neighbour.",
      repairItems: JSON.stringify(["Tailgate scratch"]),
      channel: "email",
      status: JobStatus.BOOKED,
      quoteAmount: 410,
      isDemo: true,
      bookedStart: tuesday.start,
      bookedEnd: tuesday.end,
      calendarEventId: "demo-liam-stirling",
      lastActivityAt: adelaideAt(5, 14, 10),
    },
    {
      id: "job-tom",
      customerName: "Tom Brennan",
      customerEmail: "tom.brennan@example.com",
      customerPhone: "0418 667 201",
      vehicle: "Ford Ranger — bumper",
      suburb: "Brighton",
      address: "22 The Esplanade, Brighton SA 5048",
      damageNotes: "Seeded booked southern job so Glenelg recommendations sit nearby.",
      repairItems: JSON.stringify(["Front bumper scuff"]),
      channel: "email",
      status: JobStatus.BOOKED,
      quoteAmount: 360,
      isDemo: true,
      bookedStart: wednesday.start,
      bookedEnd: wednesday.end,
      calendarEventId: "demo-tom-brighton",
      lastActivityAt: adelaideAt(4, 9, 0),
    },
    {
      id: "job-eve",
      customerName: "Eve Tan",
      customerEmail: "eve.tan@example.com",
      customerPhone: "0422 109 554",
      vehicle: "Hyundai i30 — door",
      suburb: "Somerton Park",
      address: "9 Whyte Street, Somerton Park SA 5044",
      damageNotes: "Seeded booked coastal job for Thursday clustering.",
      repairItems: JSON.stringify(["Door scratch"]),
      channel: "email",
      status: JobStatus.BOOKED,
      quoteAmount: 290,
      isDemo: true,
      bookedStart: thursday.start,
      bookedEnd: thursday.end,
      calendarEventId: "demo-eve-somerton",
      lastActivityAt: adelaideAt(1, 11, 5),
    },
  ];

  for (const job of nearbyBooked) {
    await prisma.job.upsert({
      where: { id: job.id },
      create: job,
      update: {
        bookedStart: job.bookedStart,
        bookedEnd: job.bookedEnd,
        status: JobStatus.BOOKED,
        suburb: job.suburb,
        lastActivityAt: job.lastActivityAt,
      },
    });
  }

  const demoPhotos: Record<string, { url: string; filename: string }[]> = {
    "job-jenny": [
      { url: "/demo/jenny-bumper.svg", filename: "bmw-bumper.jpg" },
      { url: "/demo/jenny-bumper-close.svg", filename: "bmw-bumper-close.jpg" },
    ],
    "job-nathan": [{ url: "/demo/nathan-door.svg", filename: "outlander-door.jpg" }],
    "job-john": [{ url: "/demo/john-quarter.svg", filename: "crv-quarter.jpg" }],
    "job-mia": [{ url: "/demo/mia-bumper.svg", filename: "corolla-bumper.jpg" }],
    "job-priya": [{ url: "/demo/priya-door.svg", filename: "mazda-door-ding.jpg" }],
    "job-liam": [{ url: "/demo/liam-tailgate.svg", filename: "hilux-tailgate.jpg" }],
    "job-tom": [{ url: "/demo/tom-bumper.svg", filename: "ranger-bumper.jpg" }],
    "job-eve": [{ url: "/demo/eve-door.svg", filename: "i30-door.jpg" }],
  };
  for (const [jobId, photos] of Object.entries(demoPhotos)) {
    const existing = await prisma.photo.count({ where: { jobId } });
    if (existing > 0) continue;
    for (const [index, photo] of photos.entries()) {
      await prisma.photo.create({
        data: {
          jobId,
          url: photo.url,
          filename: photo.filename,
          source: "demo",
          isPrimary: index === 0,
          sortOrder: index,
        },
      });
    }
  }

  const demoActivity: Record<string, Date> = {
    "job-jenny": adelaideAt(0, 9, 14),
    "job-sam": adelaideAt(0, 8, 55),
    "job-jamie": adelaideAt(0, 8, 40),
    "job-john": adelaideAt(1, 16, 32),
    "job-eve": adelaideAt(1, 11, 5),
    "job-mia": adelaideAt(2, 13, 18),
    "job-priya": adelaideAt(2, 15, 40),
    "job-nathan": adelaideAt(3, 10, 20),
    "job-tom": adelaideAt(4, 9, 0),
    "job-liam": adelaideAt(5, 14, 10),
  };
  for (const [id, lastActivityAt] of Object.entries(demoActivity)) {
    await prisma.job.update({
      where: { id },
      data: { lastActivityAt },
    });
  }

  const notes = [
    {
      id: "ntf-john-book",
      jobId: "job-john",
      type: "booking_approval",
      title: "John Hale is waiting for your booking approval",
      body: "Yes, Wednesday afternoon is fine.",
      href: "/jobs/job-john/book",
    },
    {
      id: "ntf-mia-book",
      jobId: "job-mia",
      type: "booking_approval",
      title: "Mia Chen is waiting for your booking approval",
      body: "Happy with the quote — can you book me in next week after 1pm?",
      href: "/jobs/job-mia/book",
    },
  ];

  await prisma.notification.deleteMany({
    where: { id: { in: ["ntf-nathan-book"] } },
  });

  for (const note of notes) {
    await prisma.notification.upsert({
      where: { id: note.id },
      create: note,
      update: {},
    });
  }

  const { runPhotoAndScopeAutomations } = await import("../src/lib/automations");
  await runPhotoAndScopeAutomations("job-jamie");
  await runPhotoAndScopeAutomations("job-sam");

  console.log(
    "Seeded demo jobs: Jenny, Nathan, John, Mia, Priya, Jamie (Paradise bonnet, out of scope, decline drafted), Sam (door, photo ask), plus booked neighbours (Stirling, Brighton, Somerton Park) and booking-approval notifications.",
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
