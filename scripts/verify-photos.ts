import { primaryPhoto, sortPhotos } from "../src/lib/photos";
import { prisma } from "../src/lib/prisma";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const withPhotos = await prisma.job.findMany({
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
    include: { photos: true },
  });
  assert(withPhotos.length === 8, `Expected 8 demo jobs with photos, found ${withPhotos.length}`);
  for (const job of withPhotos) {
    assert(job.photos.length > 0, `${job.id} should show a repair photo`);
    assert(primaryPhoto(job.photos), `${job.id} needs a primary thumbnail`);
  }

  const jenny = withPhotos.find((job) => job.id === "job-jenny");
  assert(jenny && jenny.photos.length >= 2, "Jenny should have wide + close-up shots");
  assert(sortPhotos(jenny!.photos)[0].url.includes("jenny-bumper"), "Jenny primary should be the bumper shot");

  const jamie = await prisma.job.findUnique({
    where: { id: "job-jamie" },
    include: { photos: true },
  });
  const sam = await prisma.job.findUnique({
    where: { id: "job-sam" },
    include: { photos: true },
  });
  assert(jamie && jamie.photos.length === 0, "Jamie is the no-photo bonnet enquiry");
  assert(sam && sam.photos.length === 0, "Sam is the in-scope no-photo door enquiry");
  assert(jamie?.outOfScope, "Jamie bonnet job should be out of scope");
  assert(!sam?.outOfScope, "Sam door job should stay in scope");

  console.log(JSON.stringify({ ok: true, jennyPhotos: jenny!.photos.length }, null, 2));
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
