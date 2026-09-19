"use server";

import { JobStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { createGmailDraft, sendGmailMessage } from "@/lib/google";
import { parsePrice } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { syncJobGmailLabelById } from "@/lib/gmail-labels";
import { buildQuoteEmail, quoteSubject } from "@/lib/quote";

export type QuoteResult = {
  ok: boolean;
  message: string;
  draftId?: string;
};

export async function saveQuoteAction(input: {
  jobId: string;
  amount: string;
  repairItems: string[];
  send: boolean;
}): Promise<QuoteResult> {
  const amount = parsePrice(input.amount);
  if (amount == null) {
    return {
      ok: false,
      message: "Enter the price yourself — this desk will not guess one.",
    };
  }

  const items = input.repairItems.map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) {
    return { ok: false, message: "Add at least one repair item for the quote." };
  }

  const job = await prisma.job.findUnique({ where: { id: input.jobId } });
  if (!job) {
    return { ok: false, message: "Job not found." };
  }
  if (!job.customerEmail) {
    return { ok: false, message: "Add the customer email before drafting." };
  }

  const body = buildQuoteEmail({
    customerName: job.customerName,
    repairItems: items,
    total: amount,
  });
  const subject = quoteSubject(job.vehicle, job.suburb);
  const settings = await getSettings();
  const session = await auth();
  const googleReady = Boolean(session?.accessToken);
  const demo = isDemoMode() || !googleReady;

  let gmailDraftId: string | null = null;
  let sentAt: Date | null = null;

  if (!demo) {
    if (input.send) {
      const sent = await sendGmailMessage({
        to: job.customerEmail,
        from: settings.businessEmail,
        subject,
        body,
        threadId: job.gmailThreadId ?? job.threadId,
      });
      if (!sent) {
        return { ok: false, message: "Could not send via Gmail. Try again or save a draft." };
      }
      sentAt = new Date();
    } else {
      gmailDraftId = await createGmailDraft({
        to: job.customerEmail,
        from: settings.businessEmail,
        subject,
        body,
        threadId: job.gmailThreadId ?? job.threadId,
      });
    }
  }

  const draft = await prisma.emailDraft.create({
    data: {
      jobId: job.id,
      type: "quote",
      subject,
      body,
      gmailDraftId,
      sentAt,
    },
  });

  const now = new Date();
  const becomingAwaiting =
    job.status === JobStatus.NEEDS_QUOTE || input.send;
  await prisma.job.update({
    where: { id: job.id },
    data: {
      quoteAmount: amount,
      repairItems: JSON.stringify(items),
      status:
        job.status === JobStatus.NEEDS_QUOTE
          ? JobStatus.AWAITING_CUSTOMER
          : job.status,
      awaitingSince:
        becomingAwaiting && !job.awaitingSince ? now : job.awaitingSince,
      quoteSentAt: input.send ? now : job.quoteSentAt,
      lastOutboundAt: input.send ? now : job.lastOutboundAt,
      lastActivityAt: now,
    },
  });
  await syncJobGmailLabelById(job.id);

  revalidatePath("/");
  revalidatePath(`/jobs/${job.id}`);
  revalidatePath(`/jobs/${job.id}/quote`);

  if (input.send && demo) {
    return {
      ok: true,
      draftId: draft.id,
      message:
        "Demo mode — the quote was saved here but not emailed. Connect Google to send for real.",
    };
  }
  if (input.send) {
    return { ok: true, draftId: draft.id, message: "Quote sent from Gmail." };
  }
  if (demo) {
    return {
      ok: true,
      draftId: draft.id,
      message:
        "Quote draft saved on this job. Connect Google to also drop it into Gmail Drafts.",
    };
  }
  return {
    ok: true,
    draftId: draft.id,
    message: gmailDraftId
      ? "Gmail draft created. Nothing has been sent."
      : "Quote saved locally. Gmail did not return a draft id.",
  };
}
