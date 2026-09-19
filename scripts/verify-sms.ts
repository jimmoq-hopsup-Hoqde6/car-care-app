import { OWNER_MOBILE_E164, formatAuMobile, toE164Au } from "../src/lib/phone";
import { isDemoMode } from "../src/lib/env";
import { prisma } from "../src/lib/prisma";
import { handleSmsWebhookPayload } from "../src/lib/sms/inbound";
import { parseMessageMediaInbound } from "../src/lib/sms/messagemedia";
import { sendSms } from "../src/lib/sms/provider";
import { parseTwilioInbound } from "../src/lib/sms/twilio";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(toE164Au("0435222221") === "+61435222221", "0435 normalises to E.164");
  assert(toE164Au("0435 222 221") === "+61435222221", "Spaced 0435 normalises");
  assert(toE164Au("+61 435 222 221") === "+61435222221", "+61 435 normalises");
  assert(toE164Au("61435222221") === "+61435222221", "61 prefix normalises");
  assert(OWNER_MOBILE_E164 === "+61435222221", "Owner source number is +61435222221");
  assert(formatAuMobile("+61435222221") === "0435 222 221", "Display stays 0435 222 221");

  const mm = parseMessageMediaInbound({
    sourceAddress: "+61411555019",
    destinationAddress: "+61435222221",
    replyContent: "Door photos coming",
    id: "mm-test-1",
  });
  assert(mm?.from === "+61411555019", "MessageMedia inbound From");
  assert(mm?.body === "Door photos coming", "MessageMedia inbound body");

  const twilio = parseTwilioInbound({
    From: "+61412334880",
    To: "+61435222221",
    Body: "Twilio-style reply",
    MessageSid: "SM123",
  });
  assert(twilio?.provider === "twilio", "Twilio fallback parser");
  assert(twilio?.from === "+61412334880", "Twilio From");

  const send = await sendSms({
    to: "+61411555019",
    body: "Demo send must not hit MessageMedia",
  });
  assert(isDemoMode(), "SMS verify runs in demo");
  assert(!send.delivered, "Demo SMS is not delivered");
  assert(/demo|not called|queued/i.test(send.reason), "Demo send no-ops");

  const taylor = await prisma.job.findUnique({
    where: { id: "job-taylor" },
    include: { smsMessages: true },
  });
  assert(taylor, "Taylor SMS job is seeded");
  assert(taylor?.channel === "sms", "Taylor channel is SMS");
  assert(taylor?.customerPhoneE164 === "+61411555019", "Taylor phone is E.164");
  assert((taylor?.smsMessages.length ?? 0) >= 2, "Taylor has an SMS thread");
  assert(
    taylor?.smsMessages.some((item) => item.direction === "inbound"),
    "Taylor thread includes inbound",
  );
  assert(
    taylor?.smsMessages.every((item) => !item.delivered || item.direction === "inbound"),
    "Demo outbound SMS is not live-delivered",
  );
  assert(
    !taylor?.smsMessages.some((item) => /\$\d/.test(item.body)),
    "SMS thread must not invent a price",
  );

  const ingested = await handleSmsWebhookPayload({
    source_number: "0418 667 201",
    destination_number: "0435222221",
    content: "Webhook attach test for Tom",
    message_id: "verify-tom-webhook",
  });
  assert(ingested.kind === "inbound", "Webhook accepts MessageMedia payload");
  assert(ingested.kind === "inbound" && ingested.jobId === "job-tom", "Inbound matches Tom by mobile");

  const { friendlySmsError } = await import("../src/lib/sms/provider");
  assert(
    /My own numbers/i.test(
      friendlySmsError("failed", "The source_number is not authorised"),
    ),
    "Unauthorised MessageMedia number is explained in Australian English",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        owner: OWNER_MOBILE_E164,
        taylorMessages: taylor?.smsMessages.length,
      },
      null,
      2,
    ),
  );
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
