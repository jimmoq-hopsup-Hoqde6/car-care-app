import { fromZonedTime } from "date-fns-tz";
import { formatLastActivity } from "../src/lib/activity";
import { ADELAIDE_TZ } from "../src/lib/constants";
import { prisma } from "../src/lib/prisma";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const now = fromZonedTime("2026-09-19T15:00:00", ADELAIDE_TZ);

  assert(
    formatLastActivity(fromZonedTime("2026-09-19T11:58:00", ADELAIDE_TZ), now) ===
      "Today · 11:58 am",
    "Today should format as Today · 11:58 am",
  );
  assert(
    formatLastActivity(fromZonedTime("2026-09-18T16:32:00", ADELAIDE_TZ), now) ===
      "Yesterday · 4:32 pm",
    "Yesterday should format as Yesterday · 4:32 pm",
  );
  assert(
    formatLastActivity(fromZonedTime("2026-09-17T10:00:00", ADELAIDE_TZ), now) ===
      "Thu 17 Sep · 10:00 am",
    "This week should include weekday, date and time",
  );
  assert(
    formatLastActivity(
      fromZonedTime("2026-09-17T10:00:00", ADELAIDE_TZ),
      now,
      { compact: true },
    ) === "17 Sep · 10:00 am",
    "Board compact form should drop the weekday",
  );
  assert(
    formatLastActivity(fromZonedTime("2026-09-01T09:05:00", ADELAIDE_TZ), now) ===
      "1 Sep · 9:05 am",
    "Older same-year dates should keep the time",
  );
  assert(
    formatLastActivity(fromZonedTime("2025-12-30T08:00:00", ADELAIDE_TZ), now) ===
      "30 Dec 2025 · 8:00 am",
    "Other years should include the year",
  );

  const jobs = await prisma.job.findMany({
    where: {
      id: {
        in: [
          "job-jenny",
          "job-nathan",
          "job-john",
          "job-mia",
          "job-priya",
          "job-liam",
          "job-tom",
          "job-eve",
        ],
      },
    },
    select: { id: true, lastActivityAt: true, customerName: true },
  });

  assert(jobs.length === 8, `Expected 8 demo jobs with lastActivityAt, found ${jobs.length}`);
  for (const job of jobs) {
    assert(job.lastActivityAt, `${job.id} is missing lastActivityAt`);
  }

  const unique = new Set(jobs.map((job) => job.lastActivityAt!.getTime()));
  assert(unique.size >= 6, "Demo lastActivityAt values should be staggered");

  const jenny = jobs.find((job) => job.id === "job-jenny");
  const nathan = jobs.find((job) => job.id === "job-nathan");
  if (!jenny || !nathan) {
    throw new Error("Jenny and Nathan must be seeded");
  }
  assert(
    jenny.lastActivityAt > nathan.lastActivityAt,
    "Jenny (today) should be newer than Nathan (stalled quote)",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        sample: formatLastActivity(jenny.lastActivityAt),
        seeded: jobs.map((job) => ({
          id: job.id,
          lastActivityAt: job.lastActivityAt,
        })),
      },
      null,
      2,
    ),
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
