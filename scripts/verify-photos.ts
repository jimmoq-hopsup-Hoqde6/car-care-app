import { buildPhotoAskEmail, SCOPE_DECLINE_FRAMING } from "../src/lib/automation-copy";
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
          "job-alex",
        ],
      },
    },
    include: { photos: true },
  });
  assert(withPhotos.length === 9, `Expected 9 demo jobs with photos, found ${withPhotos.length}`);
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
    include: { photos: true, automations: true, drafts: true },
  });
  assert(jamie && jamie.photos.length === 0, "Jamie is the no-photo bonnet enquiry");
  assert(sam && sam.photos.length === 0, "Sam is the in-scope no-photo door enquiry");
  assert(formSaysNoPhotos(jamie?.damageNotes), "Jamie form said no photos uploaded");
  assert(!hasUsablePhotos(jamie?.photos ?? [], jamie?.damageNotes), "Jamie has no usable photos");
  assert(jamie?.outOfScope, "Jamie bonnet job should be out of scope");
  assert(jamie?.declinedAt, "Jamie should have a decline drafted");
  assert(!jamie?.photoAskSentAt, "Out-of-scope jobs must not get a photo-ask");
  assert(
    !jamie?.automations.some((event) => event.type === "photo_ask"),
    "Jamie must not queue a photo-ask",
  );
  const jamieDecline = jamie?.drafts.find((draft) => draft.type === "scope_decline");
  assert(jamieDecline, "Jamie stores the decline draft");
  assert(
    jamieDecline?.body.includes(SCOPE_DECLINE_FRAMING),
    "Jamie decline uses Marcel's professional wording",
  );
  assert(jamieDecline?.body.startsWith("Hi Jamie,"), "Jamie decline uses first name");
  assert(jamieDecline?.body.includes("0435 222 221"), "Jamie decline includes the mobile");
  assert(
    jamie?.automations.some((event) => event.type === "scope_decline" && !event.delivered),
    "Jamie decline is drafted, not emailed",
  );
  assert(!sam?.outOfScope, "Sam door job should stay in scope");
  assert(sam?.photoAskSentAt, "Sam photo-ask should be queued");
  assert(
    sam?.automations.some((event) => event.type === "photo_ask" && !event.delivered),
    "Sam demo photo-ask is queued, not emailed",
  );

  const ask = buildPhotoAskEmail({
    customerName: "Sam Vella",
    suburb: "Norwood",
    service: "driver door scratch",
    notes: sam?.damageNotes,
  });
  assert(ask.startsWith("Hi Sam,"), "Photo ask uses first name");
  assert(ask.includes("panel/bonnet"), "Photo ask asks for panel/bonnet shots");
  assert(ask.includes("0435 222 221"), "Photo ask signs off with owner mobile");
  assert(!/estimated total|\$\d/i.test(ask), "Photo ask must not invent a price");
  const samDraft = sam?.drafts.find((draft) => draft.type === "photo_ask")?.body ?? "";
  assert(samDraft.startsWith("Hi Sam,"), "Sam stores the photo-ask copy");

  const settings = await prisma.appSetting.findUnique({ where: { id: "default" } });
  assert(settings?.autoAskPhotos !== false, "Auto-ask for photos when missing defaults on");
  assert(!settings?.autoDeclineOutOfScope, "Out-of-scope declines default to draft");

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
