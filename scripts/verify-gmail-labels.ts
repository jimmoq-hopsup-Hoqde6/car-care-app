import { JobStatus } from "@prisma/client";
import {
  gmailThreadIdForSync,
  labelKeyForJob,
  namesMatchDeskLabel,
  pickDeskLabel,
  statusFromDeskLabel,
  syncJobGmailLabel,
} from "../src/lib/gmail-labels";
import { prisma } from "../src/lib/prisma";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(namesMatchDeskLabel("Quote request", "Quote request"), "exact name");
assert(
  namesMatchDeskLabel("quote-request", "Quote request"),
  "fuzzy quote request",
);
assert(
  namesMatchDeskLabel("Job desk/Follow-up / Review", "Follow-up / Review"),
  "nested follow-up label",
);

assert(
  labelKeyForJob({ status: JobStatus.NEEDS_QUOTE }) === "quote_request",
  "needs quote",
);
assert(
  labelKeyForJob({ status: JobStatus.AWAITING_CUSTOMER }) ===
    "awaiting_customer",
  "awaiting",
);
assert(
  labelKeyForJob({
    status: JobStatus.AWAITING_CUSTOMER,
    followUpSentAt: new Date(),
  }) === "follow_up_review",
  "stalled follow-up",
);
assert(
  labelKeyForJob({ status: JobStatus.READY_TO_BOOK }) === "ready_to_book",
  "ready",
);
assert(labelKeyForJob({ status: JobStatus.BOOKED }) === "booked", "booked");
assert(
  labelKeyForJob({ status: JobStatus.DONE }) === "follow_up_review",
  "done / review",
);

assert(
  statusFromDeskLabel("quote_request") === JobStatus.NEEDS_QUOTE,
  "seed quote request",
);
assert(
  statusFromDeskLabel("awaiting_customer") === JobStatus.AWAITING_CUSTOMER,
  "seed awaiting",
);
assert(
  statusFromDeskLabel("ready_to_book") === JobStatus.READY_TO_BOOK,
  "seed ready",
);
assert(statusFromDeskLabel("booked") === JobStatus.BOOKED, "seed booked");
assert(
  statusFromDeskLabel("follow_up_review") === JobStatus.AWAITING_CUSTOMER,
  "seed follow-up as awaiting",
);

assert(
  pickDeskLabel(["quote_request", "ready_to_book"]) === "ready_to_book",
  "later stage wins",
);
assert(
  !gmailThreadIdForSync({
    status: JobStatus.NEEDS_QUOTE,
    threadId: "demo-thread-jenny",
  }),
  "demo threads are not synced to Gmail",
);

async function main() {
  const demoSync = await syncJobGmailLabel({
    status: JobStatus.READY_TO_BOOK,
    threadId: "demo-thread-john",
  });
  assert(demoSync.ok, "demo sync should not throw");
  assert(
    demoSync.reason.includes("demo"),
    "demo sync must not write to Gmail",
  );
  assert(
    !/send|email the customer|messages\.send/i.test(demoSync.reason),
    "label sync must not send customer email",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        demoApplied: demoSync.applied,
        reason: demoSync.reason,
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
