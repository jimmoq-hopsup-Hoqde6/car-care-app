import { buildPhotoAskEmail } from "../src/lib/automation-copy";
import { formSaysNoPhotos, hasUsablePhotos, primaryPhoto, sortPhotos } from "../src/lib/photos";
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
    include: { photos: true, automations: true, drafts: true },
  });
  const sam = await prisma.job.findUnique({
    where: { id: "job-sam" },
    include: { photos: true, automations: true },
  });
  assert(jamie && jamie.photos.length === 0, "Jamie is the no-photo Paradise enquiry");
  assert(sam && sam.photos.length === 0, "Sam is the in-scope no-photo door enquiry");
  assert(formSaysNoPhotos(jamie?.damageNotes), "Jamie form said no photos uploaded");
  assert(!hasUsablePhotos(jamie?.photos ?? [], jamie?.damageNotes), "Jamie has no usable photos");
  assert(jamie?.photoAskSentAt, "Jamie photo-ask should be queued once");
  assert(jamie?.lastActivityAt, "Jamie lastActivityAt should update with the photo-ask");
  assert(!jamie?.declinedAt, "Jamie photo-ask is not a decline");
  assert(
    jamie?.automations.some((event) => event.type === "photo_ask" && !event.delivered),
    "Jamie demo photo-ask is queued, not emailed",
  );
  assert(
    jamie?.drafts.some((draft) => draft.type === "photo_ask"),
    "Jamie stores the photo-ask copy on the job",
  );
  assert(sam?.photoAskSentAt, "Sam photo-ask should also be queued");

  const ask = jamie?.drafts.find((draft) => draft.type === "photo_ask")?.body
    ?? buildPhotoAskEmail({
      customerName: "Jamie Collis",
      suburb: "Paradise",
      service: "panel repair",
      notes: jamie?.damageNotes,
    });
  assert(ask.startsWith("Hi Jamie,"), "Photo ask uses first name");
  assert(ask.includes("panel repair in Paradise"), "Photo ask mentions service and suburb");
  assert(ask.includes("panel/bonnet"), "Photo ask asks for panel/bonnet shots");
  assert(ask.includes("ceramic coating"), "Photo ask mentions coating when present");
  assert(ask.includes("0435 222 221"), "Photo ask signs off with owner mobile");
  assert(!/estimated total|\$\d/i.test(ask), "Photo ask must not invent a price");

  const settings = await prisma.appSetting.findUnique({ where: { id: "default" } });
  assert(settings?.autoAskPhotos !== false, "Auto-ask for photos when missing defaults on");

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
