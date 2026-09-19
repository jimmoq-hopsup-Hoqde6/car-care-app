import { isPublicPath } from "../src/lib/auth.config";
import {
  autoImportEligibleInbox,
  findJobForThread,
  importEligibleInbox,
  importThreadToBoard,
} from "../src/lib/board-import";
import {
  classifyThread,
  demoInboxThreads,
  friendlyInboxError,
  isEligibleForAutoImport,
  loadInbox,
} from "../src/lib/inbox";
import { prisma } from "../src/lib/prisma";
import { getSettings } from "../src/lib/settings";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(
    classifyThread({
      from: "Manheim <noreply@manheim.com.au>",
      subject: "Auction highlights",
      snippet: "This week's wholesale listings",
    }) === "marketing",
    "Manheim classifies as marketing",
  );
  assert(
    !isEligibleForAutoImport({
      kind: "marketing",
      ignored: true,
    }),
    "Marketing is never auto-added",
  );
  assert(
    isEligibleForAutoImport({ kind: "quote_request", ignored: false }),
    "Quote requests are auto-added",
  );
  assert(
    isEligibleForAutoImport({ kind: "website_form", ignored: false }),
    "Website forms are auto-added",
  );
  assert(
    isEligibleForAutoImport({ kind: "booking_negotiation", ignored: false }),
    "Booking replies are auto-added",
  );
  assert(
    isEligibleForAutoImport({ kind: "time_confirmation", ignored: false }),
    "Time confirmations are auto-added",
  );
  assert(
    isEligibleForAutoImport({ kind: "sms", ignored: false }),
    "SMS threads are auto-added",
  );
  assert(
    !isEligibleForAutoImport({ kind: "other", ignored: false }),
    "Unclassified other is not auto-added",
  );
  assert(
    isEligibleForAutoImport({
      kind: "other",
      ignored: false,
      deskLabel: "awaiting_customer",
    }),
    "Desk-labelled other is treated as in-scope customer work",
  );
  assert(
    /Reconnect Google/i.test(
      friendlyInboxError(new Error("invalid_grant: Token has been expired or revoked")),
    ),
    "Expired Gmail tokens get a reconnect message",
  );
  assert(
    /could not be loaded/i.test(friendlyInboxError(new Error("unexpected"))),
    "Unknown Gmail errors stay friendly",
  );
  assert(
    isPublicPath("/api/inbox/sync"),
    "Cron can hit /api/inbox/sync without a login session",
  );

  const loaded = await loadInbox();
  assert(!loaded.error, "Demo inbox load does not error");
  const manheim = loaded.threads.find((thread) => thread.kind === "marketing");
  assert(manheim?.ignored, "Manheim stays ignored");
  assert(
    !isEligibleForAutoImport(manheim!),
    "Ignored Manheim thread is not eligible",
  );

  const first = await importEligibleInbox();
  assert(!first.error, "Demo auto-import does not error");
  const kai = await findJobForThread("demo-thread-kai");
  assert(kai, "Kai quote request lands on the board without a tap");
  assert(kai?.customerEmail === "kai.bennett@example.com", "Kai email is stored");
  assert(kai?.status === "NEEDS_QUOTE", "Kai is Needs quote");
  assert(!kai?.outOfScope, "Kai bumper is in scope");

  const manheimJob = await findJobForThread("demo-thread-manheim");
  assert(!manheimJob, "Manheim is not turned into a job");

  const kaiCountBefore = await prisma.job.count({
    where: { OR: [{ threadId: "demo-thread-kai" }, { gmailThreadId: "demo-thread-kai" }] },
  });
  const second = await importEligibleInbox();
  const kaiCountAfter = await prisma.job.count({
    where: { OR: [{ threadId: "demo-thread-kai" }, { gmailThreadId: "demo-thread-kai" }] },
  });
  assert(kaiCountBefore === 1 && kaiCountAfter === 1, "Re-import does not duplicate Kai");
  assert(second.imported === 0, "Second inbox pass imports nothing new");

  const stamp = Date.now().toString(36);
  const oosThread = {
    id: `demo-thread-verify-oos-${stamp}`,
    from: "Rory Quinn <rory.quinn@example.com>",
    fromEmail: "rory.quinn@example.com",
    subject: "Quote — roof scratches, Hyde Park",
    snippet: "Scratches across the roof. Can you repair it?",
    kind: "quote_request" as const,
    ignored: false,
  };
  const oos = await importThreadToBoard(oosThread);
  assert(oos.created, "OOS thread creates a job");
  const oosJob = await prisma.job.findUnique({
    where: { id: oos.jobId },
    include: { drafts: true, automations: true },
  });
  assert(oosJob?.outOfScope, "Bonnet/roof import is flagged out of scope");
  assert(
    oosJob?.automations.some((item) => item.type === "scope_decline") ||
      oosJob?.drafts.some((item) => /bonnet and the roof/i.test(item.body)),
    "OOS import prepares the decline path",
  );
  assert(
    !oosJob?.automations.some((item) => item.type === "photo_ask"),
    "OOS import does not photo-ask",
  );

  const photoThread = {
    id: `demo-thread-verify-photo-${stamp}`,
    from: "Ivy Shaw <ivy.shaw@example.com>",
    fromEmail: "ivy.shaw@example.com",
    subject: "Website enquiry — door scratch, Burnside",
    snippet: "Long scratch on the driver door. No photos uploaded.",
    kind: "website_form" as const,
    ignored: false,
  };
  const photo = await importThreadToBoard(photoThread);
  const photoJob = await prisma.job.findUnique({
    where: { id: photo.jobId },
    include: { automations: true, photos: true },
  });
  assert(photoJob, "Missing-photo import creates a job");
  assert((photoJob?.photos.length ?? 0) === 0, "Verify photo job has no photos");
  assert(photoJob?.photoAskSentAt, "Missing-photo import still auto photo-asks");
  assert(
    photoJob?.automations.some((item) => item.type === "photo_ask"),
    "Photo-ask automation is queued after import",
  );

  const againOos = await importThreadToBoard(oosThread);
  assert(!againOos.created && againOos.jobId === oos.jobId, "OOS import is idempotent");

  const settings = await getSettings();
  await prisma.appSetting.update({
    where: { id: "default" },
    data: { autoAddInboxToBoard: false },
  });
  const skipped = await autoImportEligibleInbox([
    {
      id: `demo-thread-verify-skip-${stamp}`,
      from: "Skip Me <skip@example.com>",
      fromEmail: "skip@example.com",
      subject: "Quote — bumper, Norwood",
      snippet: "Bumper scratch, photos attached.",
      kind: "quote_request",
      ignored: false,
    },
  ]);
  assert(skipped.imported === 0, "Settings toggle off skips auto-add");
  await prisma.appSetting.update({
    where: { id: "default" },
    data: { autoAddInboxToBoard: settings.autoAddInboxToBoard },
  });

  await prisma.job.deleteMany({
    where: {
      threadId: {
        in: [
          oosThread.id,
          photoThread.id,
          `demo-thread-verify-skip-${stamp}`,
        ],
      },
    },
  });

  const demo = demoInboxThreads();
  assert(
    demo.some((thread) => thread.id === "demo-thread-kai" && !thread.jobId),
    "Demo seed still exposes Kai as a new inbox thread",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        kaiJobId: kai?.id,
        inboxImportedFirstPass: first.imported,
        manheimIgnored: true,
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
