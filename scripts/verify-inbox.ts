import { isPublicPath } from "../src/lib/auth.config";
import {
  autoImportEligibleInbox,
  findJobForThread,
  importEligibleInbox,
  importThreadToBoard,
} from "../src/lib/board-import";
import {
  customerRecipientOrNull,
  extractJobIntakeFields,
  greetingFirstName,
  isCustomerReplyEmail,
  resolveInboxCustomer,
} from "../src/lib/customer-mail";
import {
  classifyThread,
  demoInboxThreads,
  friendlyInboxError,
  isEligibleForAutoImport,
  loadInbox,
} from "../src/lib/inbox";
import { emailGreeting } from "../src/lib/quote";
import { prisma } from "../src/lib/prisma";
import { getSettings } from "../src/lib/settings";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(
    !isCustomerReplyEmail("no-reply@accounts.google.com"),
    "Google security is not a customer inbox",
  );
  assert(
    !isCustomerReplyEmail("compliance@smb.sinch.com"),
    "Sinch compliance is not a customer inbox",
  );
  assert(
    !isCustomerReplyEmail("info@mobilecarscratchrepairadelaide.com.au"),
    "info@ is not a customer inbox",
  );
  assert(
    !isCustomerReplyEmail("moogly88@gmail.com"),
    "Allowlisted owner inbox is not a customer",
  );
  assert(
    isCustomerReplyEmail("michael.stewart@example.net"),
    "A real customer address is accepted",
  );
  assert(!customerRecipientOrNull("noreply@manheim.com.au"), "Manheim is stripped");
  assert(greetingFirstName("Mobile Car Scratch Repair Adelaide") === "", "Mobile is not a first name");
  assert(greetingFirstName("Info") === "", "Info is not a first name");
  assert(
    emailGreeting("Mobile Car Scratch Repair Adelaide") === "Hi there,",
    "Business name greets Hi there,",
  );
  assert(emailGreeting("Aquinnah") === "Hi Aquinnah,", "Real names still greet");

  const googleResolved = resolveInboxCustomer({
    from: "Google <no-reply@accounts.google.com>",
    fromEmail: "no-reply@accounts.google.com",
    subject: "Security alert",
    snippet: "A new sign-in on your Google Account",
  });
  assert(googleResolved.ignored && !googleResolved.email, "Google alert is ignored");
  assert(googleResolved.name === "Customer", "Google alert does not become the customer name");

  const sinchResolved = resolveInboxCustomer({
    from: "Aquinnah <compliance@smb.sinch.com>",
    fromEmail: "compliance@smb.sinch.com",
    subject: "Sinch ticket",
    snippet: "Your MessageMedia ticket update",
  });
  assert(sinchResolved.ignored && !sinchResolved.email, "Sinch is ignored");
  assert(sinchResolved.name !== "Aquinnah", "Sinch agent name is not the customer");

  const formResolved = resolveInboxCustomer({
    from: "Mobile Car Scratch Repair Adelaide <info@mobilecarscratchrepairadelaide.com.au>",
    fromEmail: "info@mobilecarscratchrepairadelaide.com.au",
    replyTo: "Michael Stewart <michael.stewart@example.net>",
    subject: "Website enquiry — bumper scratch, Magill",
    snippet:
      "Name: Michael Stewart\nEmail: michael.stewart@example.net\nPhone: 0412 555 019\nBumper scratch. No photos uploaded.",
  });
  assert(
    formResolved.email === "michael.stewart@example.net",
    "Website form uses Reply-To / Email field",
  );
  assert(/Michael/i.test(formResolved.name), "Website form uses the Name field");
  assert(formResolved.phone?.includes("0412"), "Website form parses Phone");
  assert(!formResolved.ignored, "Website form customer is not ignored");
  const formIntake = extractJobIntakeFields(
    "Website enquiry — bumper scratch, Magill\nName: Michael Stewart\nBumper scratch on a Mazda CX-5 in Magill.",
  );
  assert(formIntake.suburb === "Magill", "Form intake picks Magill");
  assert(/Mazda CX-5/i.test(formIntake.vehicle ?? ""), "Form intake picks the vehicle");

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
    !isEligibleForAutoImport({
      kind: "quote_request",
      ignored: false,
      fromEmail: "no-reply@accounts.google.com",
    }),
    "Google security alerts are never auto-added",
  );
  assert(
    !isEligibleForAutoImport({
      kind: "quote_request",
      ignored: false,
      fromEmail: "compliance@smb.sinch.com",
    }),
    "Sinch compliance mail is never auto-added",
  );
  assert(
    isEligibleForAutoImport({
      kind: "website_form",
      ignored: false,
      fromEmail: "info@mobilecarscratchrepairadelaide.com.au",
    }),
    "Website forms mailed from info@ are still imported",
  );
  assert(
    !isEligibleForAutoImport({
      kind: "quote_request",
      ignored: false,
      fromEmail: "info@mobilecarscratchrepairadelaide.com.au",
    }),
    "A quote-request From of info@ is not treated as a customer",
  );
  assert(
    classifyThread({
      from: "Google <no-reply@accounts.google.com>",
      subject: "Security alert",
      snippet: "A new sign-in on your Google Account",
    }) === "marketing",
    "Google account alerts classify as marketing",
  );
  assert(
    classifyThread({
      from: "Mobile Car Scratch Repair Adelaide <info@mobilecarscratchrepairadelaide.com.au>",
      subject: "New Quote Request",
      snippet:
        "Customer Details\nName: Pat Lee\nEmail: pat.lee@example.net\nPhone: 0411 222 333\nBumper scratch, Magill. No photos uploaded.",
    }) === "website_form",
    "New Quote Request form mail classifies as a website form",
  );
  assert(
    classifyThread({
      from: "Mobile Car Scratch Repair Adelaide <info@mobilecarscratchrepairadelaide.com.au>",
      subject: "Bumper scratch, Magill",
      snippet: "Name: Michael Stewart\nEmail: michael.stewart@example.net\nBumper scratch.",
    }) === "website_form",
    "info@ mail with Name/Email fields classifies as a website form",
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

  const boardSettings = await getSettings();
  await prisma.appSetting.update({
    where: { id: "default" },
    data: { autoAskPhotos: true },
  });

  try {
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
      include: { automations: true, photos: true, drafts: true },
    });
    assert(photoJob, "Missing-photo import creates a job");
    assert((photoJob?.photos.length ?? 0) === 0, "Verify photo job has no photos");
    assert(photoJob?.photoAskSentAt, "Missing-photo import still prepares a photo-ask draft");
    assert(
      photoJob?.automations.some((item) => item.type === "photo_ask" && !item.delivered),
      "Photo-ask is drafted, not emailed",
    );

    const googleThread = {
      id: `demo-thread-verify-google-${stamp}`,
      from: "Google <no-reply@accounts.google.com>",
      fromEmail: "no-reply@accounts.google.com",
      subject: "Security alert",
      snippet: "A new sign-in on your Google Account",
      kind: "quote_request" as const,
      ignored: false,
    };
    const googleSkipped = await autoImportEligibleInbox([googleThread]);
    assert(googleSkipped.imported === 0, "Google alerts are not auto-added");
    const google = await importThreadToBoard(googleThread);
    const googleJob = await prisma.job.findUnique({
      where: { id: google.jobId },
      include: { automations: true, drafts: true },
    });
    assert(!googleJob?.customerEmail, "Google alert is not stored as a customer email");
    assert(googleJob?.customerName === "Customer", "Google is not stored as the customer name");
    assert(!googleJob?.photoAskSentAt, "Google alert never gets a photo-ask");
    assert(
      !googleJob?.automations.some((item) => item.toEmail?.includes("accounts.google.com")),
      "No automation is addressed to Google",
    );
    assert(
      !googleJob?.drafts.some((item) => /^Hi Google,/m.test(item.body)),
      "Google is not used as a greeting",
    );

    const sinchThread = {
      id: `demo-thread-verify-sinch-${stamp}`,
      from: "Aquinnah <compliance@smb.sinch.com>",
      fromEmail: "compliance@smb.sinch.com",
      subject: "Sinch ticket",
      snippet: "MessageMedia compliance update",
      kind: "quote_request" as const,
      ignored: false,
    };
    const sinchSkipped = await autoImportEligibleInbox([sinchThread]);
    assert(sinchSkipped.imported === 0, "Sinch tickets are not auto-added");
    const sinch = await importThreadToBoard(sinchThread);
    const sinchJob = await prisma.job.findUnique({
      where: { id: sinch.jobId },
      include: { automations: true, drafts: true },
    });
    assert(!sinchJob?.customerEmail, "Sinch is not stored as a customer email");
    assert(sinchJob?.customerName !== "Aquinnah", "Sinch agent name is not the customer");
    assert(!sinchJob?.photoAskSentAt, "Sinch never gets a photo-ask");
    assert(
      !sinchJob?.drafts.some((item) => /^Hi Aquinnah,/m.test(item.body)),
      "Sinch name is not used as a customer greeting",
    );

    const formThread = {
      id: `demo-thread-verify-form-${stamp}`,
      from: "Mobile Car Scratch Repair Adelaide <info@mobilecarscratchrepairadelaide.com.au>",
      fromEmail: "info@mobilecarscratchrepairadelaide.com.au",
      replyTo: "Michael Stewart <michael.stewart@example.net>",
      subject: "Website enquiry — bumper scratch, Magill",
      snippet:
        "Name: Michael Stewart\nEmail: michael.stewart@example.net\nPhone: 0412 555 019\nBumper scratch. No photos uploaded.",
      kind: "website_form" as const,
      ignored: false,
    };
    assert(
      isEligibleForAutoImport(formThread),
      "Website form from info@ with customer details is eligible",
    );
    const form = await importThreadToBoard(formThread);
    const formJob = await prisma.job.findUnique({
      where: { id: form.jobId },
      include: { drafts: true, automations: true },
    });
    assert(
      formJob?.customerEmail === "michael.stewart@example.net",
      "Website form uses the customer Email field, not info@",
    );
    assert(/Michael/i.test(formJob?.customerName ?? ""), "Website form uses the customer Name field");
    assert(formJob?.customerPhoneE164 === "+61412555019", "Website form stores the customer mobile");
    assert(formJob?.suburb === "Magill", "Website form lead stores the suburb from the subject");
    assert(formJob?.photoAskSentAt, "Valid website-form customer can get a photo-ask draft");
    const formAsk = formJob?.drafts.find((item) => item.type === "photo_ask")?.body ?? "";
    assert(formAsk.startsWith("Hi Michael,"), "Form photo-ask greets Michael, not Hi Mobile");
    assert(!/^Hi Mobile,/m.test(formAsk), "Form photo-ask never greets Hi Mobile");
    assert(
      !formJob?.automations.some((item) =>
        item.toEmail?.toLowerCase().includes("info@mobilecarscratchrepairadelaide.com.au"),
      ),
      "Photo-ask is not addressed to info@",
    );
    assert(
      formJob?.automations.some(
        (item) =>
          item.type === "photo_ask" &&
          item.toEmail === "michael.stewart@example.net" &&
          !item.delivered,
      ),
      "Photo-ask draft is addressed to Michael only",
    );

    const nqrThread = {
      id: `demo-thread-verify-nqr-${stamp}`,
      from: "Mobile Car Scratch Repair Adelaide <info@mobilecarscratchrepairadelaide.com.au>",
      fromEmail: "info@mobilecarscratchrepairadelaide.com.au",
      subject: "New Quote Request",
      snippet:
        "Customer Details\nName: Pat Lee\nEmail: pat.lee@example.net\nPhone: 0411 222 333\nBumper scratch, Magill. Photos attached.",
      kind: "website_form" as const,
      ignored: false,
    };
    const nqrFirst = await importThreadToBoard(nqrThread);
    const nqrAgain = await importThreadToBoard(nqrThread);
    const nqrJob = await prisma.job.findUnique({
      where: { id: nqrFirst.jobId },
      include: { automations: true, photos: true },
    });
    assert(nqrFirst.created, "New Quote Request form creates a job");
    assert(!nqrAgain.created && nqrAgain.jobId === nqrFirst.jobId, "New Quote Request import is idempotent");
    assert(nqrJob?.status === "NEEDS_QUOTE", "New Quote Request lands in Needs quote");
    assert(nqrJob?.customerEmail === "pat.lee@example.net", "New Quote Request uses customer Email");
    assert(/Pat/i.test(nqrJob?.customerName ?? ""), "New Quote Request uses customer Name");
    assert(nqrJob?.customerPhoneE164 === "+61411222333", "New Quote Request stores the mobile");
    assert(
      !nqrJob?.automations.some((item) => item.type === "photo_ask"),
      "Form that says photos attached does not photo-ask",
    );

    await prisma.job.deleteMany({
      where: {
        threadId: {
          in: [
            photoThread.id,
            googleThread.id,
            sinchThread.id,
            formThread.id,
            nqrThread.id,
          ],
        },
      },
    });
  } finally {
    await prisma.appSetting.update({
      where: { id: "default" },
      data: { autoAskPhotos: false },
    });
  }

  const againOos = await importThreadToBoard(oosThread);
  assert(!againOos.created && againOos.jobId === oos.jobId, "OOS import is idempotent");

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
    data: { autoAddInboxToBoard: boardSettings.autoAddInboxToBoard },
  });

  await prisma.job.deleteMany({
    where: {
      threadId: {
        in: [oosThread.id, `demo-thread-verify-skip-${stamp}`],
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
