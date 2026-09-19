import { nextActionForJob } from "../src/lib/job-next";
import { isPublicPath } from "../src/lib/auth.config";
import { friendlyInboxError } from "../src/lib/inbox";
import { getConnectionHealth } from "../src/lib/connection-health";
import {
  friendlySmsError,
  PRODUCTION_SMS_WEBHOOK,
} from "../src/lib/sms/provider";
import { handleSmsWebhookPayload } from "../src/lib/sms/inbound";
import { prisma } from "../src/lib/prisma";

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
  assert(/booking approval/i.test(book.sentence), "Ready to book mentions approval");
  assert(book.href === "/jobs/job-y/book", "Ready to book CTA goes to picker");

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
