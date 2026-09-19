"use server";

import { revalidatePath } from "next/cache";
import { isDemoMode } from "@/lib/env";
import { formatAuMobile, ownerMobileE164, toE164Au } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { isApprovalSmsType } from "@/lib/sms/copy";
import { sendSms } from "@/lib/sms/provider";
import type { SmsType } from "@/lib/sms/types";

export type SmsActionResult = {
  ok: boolean;
  message: string;
};

export async function saveSmsAction(input: {
  jobId: string;
  body: string;
  send: boolean;
  type?: SmsType;
}): Promise<SmsActionResult> {
  const body = input.body.trim();
  if (!body) {
    return { ok: false, message: "Write a text before saving." };
  }
  if (/\b\$\s*\d/.test(body) && isApprovalSmsType(input.type ?? "reply")) {
    // Marcel may still send a quote SMS, but we never invent a figure here.
  }

  const job = await prisma.job.findUnique({ where: { id: input.jobId } });
  if (!job) return { ok: false, message: "Job not found." };
  const to = toE164Au(job.customerPhoneE164 || job.customerPhone);
  if (!to) {
    return { ok: false, message: "Add a valid Australian mobile before texting." };
  }

  const type = input.type ?? "reply";
  const now = new Date();
  const demo = isDemoMode();

  let delivered = false;
  let status = input.send ? "queued" : "drafted";
  let providerId: string | undefined;
  let error: string | undefined;
  let reason = input.send
    ? "demo — SMS queued only, MessageMedia not called"
    : "SMS draft saved on this job";

  if (input.send) {
    const result = await sendSms({ to, body });
    delivered = result.delivered;
    status = result.status === "failed" ? "failed" : result.status;
    providerId = result.id;
    error = result.error;
    reason = result.reason;
    if (result.status === "failed") {
      await prisma.smsMessage.create({
        data: {
          jobId: job.id,
          direction: "outbound",
          body,
          fromNumber: ownerMobileE164(),
          toNumber: to,
          provider: "messagemedia",
          providerId,
          status,
          delivered: false,
          demo,
          type,
          error,
        },
      });
      return { ok: false, message: result.error || result.reason };
    }
  }

  await prisma.smsMessage.create({
    data: {
      jobId: job.id,
      direction: "outbound",
      body,
      fromNumber: ownerMobileE164(),
      toNumber: to,
      provider: "messagemedia",
      providerId,
      status,
      delivered,
      demo,
      type,
    },
  });

  await prisma.job.update({
    where: { id: job.id },
    data: {
      customerPhone: job.customerPhone || formatAuMobile(to),
      customerPhoneE164: to,
      lastActivityAt: now,
      lastOutboundAt: input.send ? now : job.lastOutboundAt,
    },
  });

  revalidatePath("/");
  revalidatePath(`/jobs/${job.id}`);

  if (!input.send) {
    return { ok: true, message: "SMS draft saved. Nothing has been sent." };
  }
  if (demo) {
    return {
      ok: true,
      message: "Demo mode — the SMS was saved here but not sent via MessageMedia.",
    };
  }
  return { ok: true, message: reason };
}
