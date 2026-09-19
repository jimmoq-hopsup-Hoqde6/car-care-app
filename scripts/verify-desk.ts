import { nextActionForJob } from "../src/lib/job-next";
import {
  bookingNextCta,
  forgottenReadyToBook,
  isReadyToBookNoDate,
  waitingSinceLabel,
} from "../src/lib/booking-ops";
import { isPublicPath } from "../src/lib/auth.config";
import { cronAuthorised } from "../src/lib/cron-auth";
import { friendlyInboxError } from "../src/lib/inbox";
import { getConnectionHealth } from "../src/lib/connection-health";
import {
  friendlySmsError,
  PRODUCTION_SMS_WEBHOOK,
} from "../src/lib/sms/provider";
import { handleSmsWebhookPayload } from "../src/lib/sms/inbound";
import { prisma } from "../src/lib/prisma";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const quote = nextActionForJob({
    id: "job-x",
    status: "NEEDS_QUOTE",
    quoteAmount: null,
    outOfScope: false,
    photos: [],
  });
  assert(/Accept suggestion|enter the price/i.test(quote.sentence), "Needs quote next step");
  assert(quote.href === "/jobs/job-x/quote", "Needs quote CTA goes to composer");
  assert(quote.cta === "Write quote", "Needs quote CTA label");

  const book = nextActionForJob({
    id: "job-y",
    status: "READY_TO_BOOK",
    quoteAmount: 520,
    outOfScope: false,
  });
  assert(/no calendar date/i.test(book.sentence), "Ready to book mentions no date");
  assert(book.href === "/jobs/job-y/book", "Ready to book CTA goes to picker");
  assert(book.cta === "Offer dates", "Generic ready-to-book CTA is Offer dates");

  const confirm = nextActionForJob({
    id: "job-y2",
    status: "READY_TO_BOOK",
    quoteAmount: 520,
    outOfScope: false,
    damageNotes: "Yes, Wednesday afternoon is fine.",
  });
  assert(confirm.cta === "Confirm booking", "Named-time reply CTA is Confirm booking");

  const oos = nextActionForJob({
    id: "job-z",
    status: "NEEDS_QUOTE",
    outOfScope: true,
  });
  assert(/do not quote/i.test(oos.sentence), "OOS next step refuses a quote");
  assert(oos.tone === "warn", "OOS tone is warn");

  const wait = nextActionForJob({
    id: "job-w",
    status: "AWAITING_CUSTOMER",
    quoteAmount: 520,
  });
  assert(/follow-up/i.test(wait.sentence), "Awaiting customer mentions follow-up");

  const done = nextActionForJob({
    id: "job-d",
    status: "DONE",
  });
  assert(/review ask/i.test(done.sentence), "Done mentions review ask");

  assert(
    PRODUCTION_SMS_WEBHOOK ===
      "https://car-care-app-green.vercel.app/api/sms/messagemedia",
    "Production SMS webhook URL is documented",
  );
  assert(
    isPublicPath("/api/inbox/sync"),
    "Inbox sync endpoint is reachable without a session (cron)",
  );
  assert(
    isPublicPath("/api/automations/run"),
    "Automations run endpoint is reachable without a session (cron)",
  );

  const vercel = JSON.parse(
    readFileSync(join(process.cwd(), "vercel.json"), "utf8"),
  ) as { crons?: Array<{ path: string; schedule: string }> };
  const inboxCron = vercel.crons?.find((job) => job.path === "/api/inbox/sync");
  const autoCron = vercel.crons?.find(
    (job) => job.path === "/api/automations/run",
  );
  assert(inboxCron?.schedule === "15 22 * * *", "Inbox cron is 22:15 UTC");
  assert(autoCron?.schedule === "30 22 * * *", "Automations cron is 22:30 UTC");

  const savedAutomations = process.env.AUTOMATIONS_SECRET;
  const savedCron = process.env.CRON_SECRET;
  try {
    delete process.env.AUTOMATIONS_SECRET;
    delete process.env.CRON_SECRET;
    assert(
      cronAuthorised(new Request("https://example.com/api/automations/run")),
      "No secret — cron routes stay open for local demo",
    );

    process.env.AUTOMATIONS_SECRET = "desk-automations";
    assert(
      !cronAuthorised(new Request("https://example.com/api/automations/run")),
      "Secret set without Bearer is refused",
    );
    assert(
      cronAuthorised(
        new Request("https://example.com/api/automations/run", {
          headers: { authorization: "Bearer desk-automations" },
        }),
      ),
      "AUTOMATIONS_SECRET Bearer is accepted",
    );

    delete process.env.AUTOMATIONS_SECRET;
    process.env.CRON_SECRET = "desk-vercel-cron";
    assert(
      cronAuthorised(
        new Request("https://example.com/api/automations/run", {
          headers: { authorization: "Bearer desk-vercel-cron" },
        }),
      ),
      "Vercel CRON_SECRET Bearer is accepted",
    );
    assert(
      !cronAuthorised(
        new Request("https://example.com/api/automations/run", {
          headers: { authorization: "Bearer desk-automations" },
        }),
      ),
      "Wrong Bearer is refused",
    );
  } finally {
    if (savedAutomations === undefined) delete process.env.AUTOMATIONS_SECRET;
    else process.env.AUTOMATIONS_SECRET = savedAutomations;
    if (savedCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = savedCron;
  }
  assert(
    /My own numbers/i.test(
      friendlySmsError("MessageMedia send failed", "source_number is not authorised"),
    ),
    "Unauthorised sender gets a Marcel-facing SMS error",
  );
  assert(
    /Reconnect Google/i.test(friendlyInboxError(new Error("invalid_grant"))),
    "Inbox token errors stay friendly",
  );

  const health = await getConnectionHealth({ sessionEmail: null });
  assert(health.rows.some((row) => row.id === "google-login"), "Health includes Google login");
  assert(health.rows.some((row) => row.id === "gmail"), "Health includes Gmail token");
  assert(health.rows.some((row) => row.id === "calendar"), "Health includes Calendar");
  assert(health.rows.some((row) => row.id === "sms"), "Health includes MessageMedia");
  assert(
    health.rows.some(
      (row) => row.id === "mobile" && /0435 222 221/.test(row.detail),
    ),
    "Health shows owner mobile 0435 222 221",
  );

  const john = await prisma.job.findUnique({ where: { id: "job-john" } });
  const mia = await prisma.job.findUnique({ where: { id: "job-mia" } });
  assert(john && isReadyToBookNoDate(john), "John is ready to book with no calendar date");
  assert(mia && isReadyToBookNoDate(mia), "Mia is ready to book with no calendar date");
  assert(bookingNextCta(john!) === "Confirm booking", "John named a time");
  assert(bookingNextCta(mia!) === "Offer dates", "Mia still needs dates offered");
  const forgotten = forgottenReadyToBook([john!, mia!]);
  assert(forgotten[0]?.id === "job-mia", "Oldest waiting ready-to-book is first");
  assert(/Waiting/.test(waitingSinceLabel(john!)), "John shows a waiting badge");

  const stamp = Date.now().toString().slice(-8);
  const from = `0418${stamp.slice(0, 6)}`.slice(0, 10);
  const ingested = await handleSmsWebhookPayload({
    source_number: from,
    destination_number: "0435222221",
    content: "Unknown number quote request — door scratch",
    message_id: `verify-unknown-${stamp}`,
  });
  assert(ingested.kind === "inbound", "Unknown SMS is ingested");
  if (ingested.kind === "inbound") {
    const job = await prisma.job.findUnique({ where: { id: ingested.jobId } });
    assert(job?.status === "NEEDS_QUOTE", "Unknown SMS creates Needs quote");
    assert(job?.channel === "sms", "Unknown SMS job is SMS channel");
    await prisma.job.delete({ where: { id: job!.id } }).catch(() => null);
  }

  console.log(JSON.stringify({ ok: true, quoteCta: quote.cta, bookCta: book.cta }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
