import { buildPhotoAskEmail, SCOPE_DECLINE_FRAMING } from "../src/lib/automation-copy";
import { importThreadToBoard } from "../src/lib/board-import";
import {
  collectGmailImageParts,
  decodeGmailData,
  looksLikeImagePart,
  storeGmailImageBuffers,
} from "../src/lib/gmail-photos";
import { formSaysNoPhotos, hasUsablePhotos, primaryPhoto, sortPhotos, usablePhotoUrl } from "../src/lib/photos";
import { createJobPhoto, sniffImageMime } from "../src/lib/photo-store";
import { prisma } from "../src/lib/prisma";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(usablePhotoUrl("/demo/jenny-bumper.svg"), "Demo SVG URLs are usable thumbs");
  assert(usablePhotoUrl("/api/photos/abc"), "Neon-hosted photo URLs are usable");
  assert(
    usablePhotoUrl("data:image/jpeg;base64,/9j/aaaa"),
    "Inline JPEG data URLs are usable thumbs",
  );
  assert(!usablePhotoUrl(""), "Blank URL is not a thumb");
  assert(!usablePhotoUrl("pending"), "Pending URL is not a thumb");
  assert(!usablePhotoUrl("javascript:alert(1)"), "Script URLs are never shown");
  assert(sniffImageMime("image/jpg") === "image/jpeg", "image/jpg is treated as JPEG");
  assert(sniffImageMime("image/pjpeg") === "image/jpeg", "image/pjpeg is treated as JPEG");
  assert(
    sniffImageMime("application/octet-stream", "scratch.JPG") === "image/jpeg",
    "A .JPG filename is treated as JPEG",
  );
  assert(
    looksLikeImagePart({
      mimeType: "application/octet-stream",
      filename: "bumper.JPG",
      body: { attachmentId: "att-1" },
    }),
    "Gmail octet-stream JPEG attachments are detected",
  );
  assert(
    looksLikeImagePart({
      mimeType: "image/jpg",
      filename: "door.jpg",
      body: { data: "abc" },
    }),
    "image/jpg parts are detected",
  );
  const nested = collectGmailImageParts({
    mimeType: "multipart/mixed",
    parts: [
      {
        mimeType: "multipart/related",
        parts: [
          { mimeType: "text/html", body: { data: "aGVsbG8=" } },
          {
            mimeType: "image/jpeg",
            filename: "scratch.jpg",
            body: { attachmentId: "att-jpeg" },
          },
        ],
      },
    ],
  });
  assert(nested.length === 1 && nested[0].filename === "scratch.jpg", "Nested Gmail JPEG parts are found");
  const jpegBytes = Buffer.alloc(4096, 0);
  jpegBytes[0] = 0xff;
  jpegBytes[1] = 0xd8;
  jpegBytes[2] = 0xff;
  jpegBytes[3] = 0xe0;
  jpegBytes[4094] = 0xff;
  jpegBytes[4095] = 0xd9;
  const encoded = jpegBytes.toString("base64url");
  const decoded = decodeGmailData(encoded);
  assert(decoded[0] === 0xff && decoded[1] === 0xd8, "Gmail base64url JPEG data decodes");
  assert(
    !primaryPhoto([{ id: "x", url: "   " }]),
    "Empty URL does not become a board thumb",
  );
  assert(
    primaryPhoto([
      { id: "empty", url: "" },
      { id: "ok", url: "/demo/mia-bumper.svg", isPrimary: true },
    ])?.id === "ok",
    "Primary thumb skips unusable URLs",
  );

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
    assert(
      usablePhotoUrl(primaryPhoto(job.photos)?.url),
      `${job.id} primary thumb must be a loadable URL`,
    );
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
  assert(settings?.autoAskPhotos === false, "Photo-ask auto-send stays off by default");
  assert(!settings?.autoDeclineOutOfScope, "Out-of-scope declines default to draft");

  const stamp = Date.now().toString(36);
  const jpegThread = {
    id: `demo-thread-verify-jpeg-${stamp}`,
    from: "Ivy Shaw <ivy.shaw@example.com>",
    fromEmail: "ivy.shaw@example.com",
    subject: "Quote — door scratch, Burnside",
    snippet: "Long scratch on the driver door. Photos attached.",
    kind: "quote_request" as const,
    ignored: false,
  };
  const jpegImport = await importThreadToBoard(jpegThread);
  assert(jpegImport.created, "A real customer JPEG thread creates a job");
  const stored = await storeGmailImageBuffers(jpegImport.jobId, [
    { buffer: jpegBytes, mimeType: "image/jpg", filename: "scratch.JPG" },
  ]);
  assert(stored === 1, "Gmail JPEG attachment is stored on the job");
  const jpegJob = await prisma.job.findUnique({
    where: { id: jpegImport.jobId },
    include: { photos: true },
  });
  const thumb = primaryPhoto(jpegJob?.photos ?? []);
  assert(thumb, "JPEG attachment becomes the primary board thumb");
  assert(usablePhotoUrl(thumb?.url), "JPEG thumb URL is renderable");
  assert(
    Boolean(jpegJob?.photos[0]?.bytes && jpegJob.photos[0].bytes.length > 0) ||
      Boolean(thumb?.url.startsWith("data:image/")),
    "JPEG bytes are kept in the database (or inlined as a data URL)",
  );
  assert(jpegJob?.photos[0]?.source === "gmail", "Attachment is tagged as a Gmail photo");
  const direct = await createJobPhoto({
    jobId: jpegImport.jobId,
    buffer: jpegBytes,
    mimeType: "image/jpg",
    filename: "close-up.JPG",
    source: "gmail",
    isPrimary: false,
    sortOrder: 1,
  });
  assert(usablePhotoUrl(direct.url), "image/jpg uploads still produce a usable URL");

  await prisma.job.deleteMany({ where: { id: jpegImport.jobId } });

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
