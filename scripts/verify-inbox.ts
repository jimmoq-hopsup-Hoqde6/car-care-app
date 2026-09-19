import { isPublicPath } from "../src/lib/auth.config";
import {
  autoImportEligibleInbox,
  canImportThreadToBoard,
  findJobForThread,
  importEligibleInbox,
  importThreadToBoard,
  removeJunkSystemJobs,
} from "../src/lib/board-import";
import {
  customerRecipientOrNull,
  extractJobIntakeFields,
  greetingFirstName,
  isCustomerReplyEmail,
  isJunkBoardJob,
  isSystemMailSender,
  resolveInboxCustomer,
} from "../src/lib/customer-mail";
import {
  classifyThread,
  demoInboxThreads,
  friendlyInboxError,
  isEligibleForAutoImport,
  loadInbox,
  pickLatestCustomerMessage,
} from "../src/lib/inbox";
import { applyCustomerBookingReply, syncInboxNotifications } from "../src/lib/notifications";
import { looksLikeBookingConfirmation } from "../src/lib/booking-ops";
import { nextActionForJob } from "../src/lib/job-next";
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

  assert(
    isSystemMailSender({
      from: "Google <no-reply@accounts.google.com>",
      fromEmail: "no-reply@accounts.google.com",
    }),
    "Google From is a system sender",
  );
  assert(
    isSystemMailSender({
      from: "Aquinnah Mae Salas (Sinch Engage) <compliance@smb.sinch.com>",
      fromEmail: "compliance@smb.sinch.com",
    }),
    "Sinch From is a system sender",
  );
  assert(
    isSystemMailSender({
      from: "Aquinnah Mae Salas (Sinch Engage) <person@gmail.com>",
      fromEmail: "person@gmail.com",
    }),
    "Sinch Engage display name is still a system sender",
  );
  assert(
    !isSystemMailSender({
      from: "Jenny Gwynne <jenny.gwynne@example.com>",
      fromEmail: "jenny.gwynne@example.com",
    }),
    "A real customer From is not a system sender",
  );
  assert(
    isJunkBoardJob({ customerName: "Google", customerEmail: null }),
    "A card named Google is junk",
  );
  assert(
    isJunkBoardJob({
      customerName: "Aquinnah Mae Salas (Sinch Engage…)",
      customerEmail: null,
    }),
    "A Sinch Engage card is junk",
  );
  assert(
    !isJunkBoardJob({
      customerName: "Jenny Gwynne",
      customerEmail: "jenny.gwynne@example.com",
    }),
    "Jenny is not junk",
  );

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
    !isEligibleForAutoImport({
      kind: "quote_request",
      ignored: false,
      from: "Aquinnah Mae Salas (Sinch Engage) <person@gmail.com>",
      fromEmail: "person@gmail.com",
    }),
    "Sinch Engage display name is never auto-added",
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
      from: "Darren Buckney <darren.buckney@example.com>",
      subject: "Re: Quote — Mazda CX-5 — Prospect",
      snippet:
        "Yes Saturday morning works. Book me in. Address is 14 Main North Road, Prospect.",
    }) === "time_confirmation",
    "Darren Saturday confirm classifies as a time confirmation",
  );
  assert(
    looksLikeBookingConfirmation(
      "Yes Saturday morning works. Book me in. Address is 14 Main North Road, Prospect.",
    ),
    "Saturday + book me in is a booking confirmation",
  );
  const latestReply = pickLatestCustomerMessage([
    {
      internalDate: "1",
      snippet: "Website enquiry — bumper scratch, Prospect. Can you quote?",
      payload: {
        headers: [
          {
            name: "From",
            value: "Mobile Car Scratch Repair Adelaide <info@mobilecarscratchrepairadelaide.com.au>",
          },
        ],
      },
    },
    {
      internalDate: "2",
      snippet: "Quote for the Mazda CX-5 door scratch. $480.",
      payload: {
        headers: [
          {
            name: "From",
            value: "Marcel Kuhn <info@mobilecarscratchrepairadelaide.com.au>",
          },
        ],
      },
    },
    {
      internalDate: "3",
      snippet: "Yes Saturday morning works. Book me in.",
      payload: {
        headers: [
          { name: "From", value: "Darren Buckney <darren.buckney@example.com>" },
        ],
      },
    },
  ]);
  assert(
    latestReply?.email === "darren.buckney@example.com" &&
      /Saturday/i.test(latestReply.snippet),
    "Inbox sync reads the latest customer reply, not the original quote",
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
      from: "Aquinnah Mae Salas (Sinch Engage) <compliance@smb.sinch.com>",
      subject: "Sinch ticket",
      snippet: "Quote request update for your MessageMedia account",
    }) === "marketing",
    "Sinch Engage classifies as marketing even if the body says quote",
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
    assert(google.refused && !google.created, "Google never becomes a job");
    assert(!(await findJobForThread(googleThread.id)), "No Google job row is stored");

    const sinchThread = {
      id: `demo-thread-verify-sinch-${stamp}`,
      from: "Aquinnah Mae Salas (Sinch Engage) <compliance@smb.sinch.com>",
      fromEmail: "compliance@smb.sinch.com",
      subject: "Sinch ticket",
      snippet: "MessageMedia compliance update. Email: decoy@gmail.com",
      kind: "quote_request" as const,
      ignored: false,
    };
    const sinchSkipped = await autoImportEligibleInbox([sinchThread]);
    assert(sinchSkipped.imported === 0, "Sinch tickets are not auto-added");
    const sinch = await importThreadToBoard(sinchThread);
    assert(sinch.refused && !sinch.created, "Sinch never becomes a job");
    assert(!(await findJobForThread(sinchThread.id)), "No Sinch job row is stored");
    assert(
      !canImportThreadToBoard({
        ...sinchThread,
        from: "Aquinnah Mae Salas (Sinch Engage) <person@gmail.com>",
        fromEmail: "person@gmail.com",
      }),
      "Sinch Engage display name cannot be added even with a gmail From",
    );

    const junkId = `job-verify-junk-${stamp}`;
    await prisma.job.create({
      data: {
        id: junkId,
        customerName: "Aquinnah Mae Salas (Sinch Engage…)",
        customerEmail: null,
        damageNotes: "Needs quote",
        isDemo: false,
      },
    });
    const swept = await removeJunkSystemJobs();
    assert(swept >= 1, "Junk Sinch cards are removed from the board");
    assert(!(await prisma.job.findUnique({ where: { id: junkId } })), "Swept Sinch card is gone");

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

  const darrenId = `job-verify-darren-${stamp}`;
  await prisma.job.create({
    data: {
      id: darrenId,
      customerName: "Darren Buckney",
      customerEmail: "darren.buckney@example.com",
      suburb: "Prospect",
      vehicle: "Mazda CX-5",
      damageNotes: "Quote sent for the driver-door scratch.",
      status: "AWAITING_CUSTOMER",
      quoteAmount: 480,
      quoteSentAt: new Date(),
      threadId: `demo-thread-verify-darren-${stamp}`,
      isDemo: false,
    },
  });
  const darrenThread = {
    id: `demo-thread-verify-darren-${stamp}`,
    from: "Darren Buckney <darren.buckney@example.com>",
    fromEmail: "darren.buckney@example.com",
    subject: "Re: Quote — Mazda CX-5 — Prospect",
    snippet:
      "Yes Saturday morning works. Book me in. Address is 14 Main North Road, Prospect.",
    kind: "other" as const,
    ignored: false,
    jobId: darrenId,
  };
  const darrenApplied = await applyCustomerBookingReply({
    jobId: darrenId,
    snippet: darrenThread.snippet,
    subject: darrenThread.subject,
    kind: darrenThread.kind,
  });
  assert(darrenApplied.updated && darrenApplied.alerted, "Darren Saturday reply updates the job and alerts");
  const darrenJob = await prisma.job.findUnique({
    where: { id: darrenId },
    include: { drafts: true, notifications: true },
  });
  assert(darrenJob?.status === "READY_TO_BOOK", "Darren moves to Ready to book");
  assert(darrenJob?.lastCustomerReplyAt, "Darren last activity is the customer reply");
  assert(/14 Main North Road/i.test(darrenJob?.address ?? ""), "Darren address is stored from the reply");
  assert(
    darrenJob?.notifications.some((item) => item.type === "booking_approval" && !item.readAt),
    "Darren raises an unread booking-approval alert",
  );
  const darrenNext = nextActionForJob({
    ...darrenJob!,
    damageNotes: darrenJob?.damageNotes,
  });
  assert(darrenNext.cta === "Confirm booking", "Darren next action is Confirm booking");
  assert(darrenNext.href === `/jobs/${darrenId}/book`, "Darren next action opens the calendar picker");
  assert(
    !darrenJob?.drafts.some((item) => item.type === "confirmation" && item.sentAt),
    "Darren booking confirmation is never auto-sent",
  );
  const darrenAgain = await syncInboxNotifications([darrenThread]);
  assert(darrenAgain >= 0, "Re-sync of Darren does not throw");
  const darrenAfter = await prisma.job.findUnique({ where: { id: darrenId } });
  assert(darrenAfter?.status === "READY_TO_BOOK", "Darren stays Ready to book on re-sync");

  const idleId = `job-verify-idle-${stamp}`;
  await prisma.job.create({
    data: {
      id: idleId,
      customerName: "Idle Quote",
      customerEmail: "idle.quote@example.com",
      status: "AWAITING_CUSTOMER",
      quoteAmount: 300,
      quoteSentAt: new Date(),
      damageNotes: "Quote sent.",
      isDemo: false,
    },
  });
  const idle = await applyCustomerBookingReply({
    jobId: idleId,
    snippet: "Thanks Marcel. I'll check with my wife and come back to you on the quote.",
    subject: "Re: Quote",
    kind: "other",
  });
  assert(!idle.updated, "A maybe-later reply does not fake a booking confirm");
  const idleJob = await prisma.job.findUnique({ where: { id: idleId } });
  assert(idleJob?.status === "AWAITING_CUSTOMER", "Idle quote stays Awaiting customer");

  await prisma.appSetting.update({
    where: { id: "default" },
    data: { autoDraftBookingConfirm: true },
  });
  const draftId = `job-verify-draft-slot-${stamp}`;
  await prisma.job.create({
    data: {
      id: draftId,
      customerName: "Slot Picker",
      customerEmail: "slot.picker@example.com",
      status: "AWAITING_CUSTOMER",
      quoteAmount: 410,
      quoteSentAt: new Date(),
      isDemo: false,
    },
  });
  await applyCustomerBookingReply({
    jobId: draftId,
    snippet: "Tuesday afternoon is fine. Book me in.",
    kind: "time_confirmation",
  });
  const drafted = await prisma.emailDraft.findFirst({
    where: { jobId: draftId, type: "confirmation" },
  });
  assert(drafted && !drafted.sentAt, "Optional slot-confirm draft is saved, not sent");
  await prisma.appSetting.update({
    where: { id: "default" },
    data: { autoDraftBookingConfirm: false },
  });

  await prisma.job.deleteMany({
    where: { id: { in: [darrenId, idleId, draftId] } },
  });

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
