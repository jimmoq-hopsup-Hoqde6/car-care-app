import { PrismaClient, JobStatus } from "@prisma/client";

const prisma = new PrismaClient();

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function main() {
  await prisma.appSetting.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      followUpDays: Number(process.env.FOLLOW_UP_DAYS || 2),
      reviewAskDaysAfterJob: Number(process.env.REVIEW_ASK_DAYS_AFTER_JOB || 1),
      googleReviewUrl:
        process.env.GOOGLE_REVIEW_URL?.trim() ||
        "https://g.page/r/PLACEHOLDER",
    },
    update: {},
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
        },
      });
    }
  }

  console.log(
    "Seeded demo jobs: Jenny, Nathan (follow-up due), John, Priya (review ask due).",
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
