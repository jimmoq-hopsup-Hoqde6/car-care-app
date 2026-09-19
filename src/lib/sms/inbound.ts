import { JobStatus } from "@prisma/client";
import { detectOutOfScope } from "../scope";
import { formatAuMobile, ownerMobileE164, toE164Au } from "../phone";
import { prisma } from "../prisma";
import { parseMessageMediaDelivery } from "./messagemedia";
import { parseAnyInbound } from "./provider";
import { twilioAdapter } from "./twilio";
import type { InboundSms } from "./types";

export async function findJobByPhone(phone?: string | null) {
  const e164 = toE164Au(phone);
  if (!e164) return null;
  return prisma.job.findFirst({
    where: {
      OR: [{ customerPhoneE164: e164 }, { customerPhone: phone ?? "" }],
    },
    orderBy: { lastActivityAt: "desc" },
  });
}

async function createJobFromSms(inbound: InboundSms) {
  const e164 = inbound.from;
  const id = `job-sms-${e164.replace(/\D/g, "")}`;
  const existing = await prisma.job.findUnique({ where: { id } });
  if (existing) return existing;
  const display = formatAuMobile(e164);
  const outOfScope = detectOutOfScope({ damageNotes: inbound.body });
  return prisma.job.create({
    data: {
      id,
      customerName: display || "SMS customer",
      customerPhone: display,
      customerPhoneE164: e164,
      damageNotes: inbound.body,
      channel: "sms",
      threadId: `sms-${e164}`,
      status: JobStatus.NEEDS_QUOTE,
      lastActivityAt: new Date(),
      lastCustomerReplyAt: new Date(),
      outOfScope,
    },
  });
}

export async function ingestInboundSms(inbound: InboundSms) {
  const job =
    (await findJobByPhone(inbound.from)) ?? (await createJobFromSms(inbound));

  const duplicate = inbound.providerId
    ? await prisma.smsMessage.findFirst({
        where: { providerId: inbound.providerId, direction: "inbound" },
      })
    : await prisma.smsMessage.findFirst({
        where: {
          jobId: job.id,
          direction: "inbound",
          body: inbound.body,
          fromNumber: inbound.from,
        },
        orderBy: { createdAt: "desc" },
      });
  if (duplicate) {
    return { jobId: job.id, created: false, messageId: duplicate.id };
  }

  const now = new Date();
  const message = await prisma.smsMessage.create({
    data: {
      jobId: job.id,
      direction: "inbound",
      body: inbound.body,
      fromNumber: inbound.from,
      toNumber: inbound.to || ownerMobileE164(),
      provider: inbound.provider,
      providerId: inbound.providerId,
      status: "received",
      delivered: true,
      type: "reply",
    },
  });
  await prisma.job.update({
    where: { id: job.id },
    data: {
      customerPhone: job.customerPhone || formatAuMobile(inbound.from),
      customerPhoneE164: job.customerPhoneE164 || inbound.from,
      lastActivityAt: now,
      lastCustomerReplyAt: now,
      channel: job.channel === "email" ? job.channel : job.channel || "sms",
    },
  });
  return { jobId: job.id, created: true, messageId: message.id };
}

export async function applyDeliveryUpdate(update: {
  providerId: string;
  status: string;
  delivered?: boolean;
}) {
  const existing = await prisma.smsMessage.findFirst({
    where: { providerId: update.providerId },
  });
  if (!existing) return null;
  await prisma.smsMessage.update({
    where: { id: existing.id },
    data: {
      status: update.status,
      delivered: Boolean(update.delivered),
      error: update.status === "failed" ? "Delivery failed" : existing.error,
    },
  });
  return existing.id;
}

export async function handleSmsWebhookPayload(payload: unknown) {
  const inbound = parseAnyInbound(payload);
  if (inbound) {
    return {
      kind: "inbound" as const,
      ...(await ingestInboundSms(inbound)),
    };
  }
  const delivery =
    parseMessageMediaDelivery(payload) || twilioAdapter.parseDelivery(payload);
  if (delivery) {
    const id = await applyDeliveryUpdate(delivery);
    return { kind: "delivery" as const, messageId: id };
  }
  return { kind: "ignored" as const };
}
