import { PrismaClient, JobStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.appSetting.upsert({
    where: { id: "default" },
    create: { id: "default" },
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
      // Demo only — represents a figure Marcel already typed, not an invented quote.
      quoteAmount: 380,
      isDemo: true,
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
  ];

  for (const job of jobs) {
    const { photos, ...data } = job;
    await prisma.job.upsert({
      where: { id: job.id },
      create: {
        ...data,
        photos: { create: photos },
      },
      update: {},
    });
  }

  console.log("Seeded demo jobs: Jenny (Crafers), Nathan (Unley), John (Glenelg).");
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
