"use server";

import { JobStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  buildConfirmationEmail,
  confirmationSubject,
  createCalendarEvent,
  jobEventDescription,
  jobEventTitle,
} from "@/lib/booking";
import { isDemoMode } from "@/lib/env";
import { createGmailDraft } from "@/lib/google";
import { syncJobGmailLabelById } from "@/lib/gmail-labels";
import { markJobNotificationsRead } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export type BookResult = {
  ok: boolean;
  message: string;
  eventId?: string | null;
};

export async function bookSlotAction(input: {
  jobId: string;
  startIso: string;
  endIso: string;
}): Promise<BookResult> {
  const job = await prisma.job.findUnique({ where: { id: input.jobId } });
  if (!job) return { ok: false, message: "Job not found." };
  if (!job.customerEmail) {
    return { ok: false, message: "Add the customer email before booking." };
  }

  const start = new Date(input.startIso);
  const end = new Date(input.endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, message: "That time slot is not valid." };
  }

  const settings = await getSettings();
  const session = await auth();
  const googleReady = Boolean(session?.accessToken);
  const demo = isDemoMode() || !googleReady;

  const eventId = await createCalendarEvent({
    title: jobEventTitle(job),
    location: job.address ?? job.suburb,
    description: jobEventDescription(job),
    start,
    end,
    timezone: settings.timezone,
  });

  const body = buildConfirmationEmail({
    customerName: job.customerName,
    address: job.address,
    suburb: job.suburb,
    bookedStart: start,
    bookedEnd: end,
  });
  const subject = confirmationSubject({
    suburb: job.suburb,
    bookedStart: start,
  });

  let gmailDraftId: string | null = null;
  if (!demo) {
    gmailDraftId = await createGmailDraft({
      to: job.customerEmail,
      from: settings.businessEmail,
      subject,
      body,
      threadId: job.gmailThreadId ?? job.threadId,
    });
  }

  await prisma.emailDraft.create({
    data: {
      jobId: job.id,
      type: "confirmation",
      subject,
      body,
      gmailDraftId,
    },
  });

  await prisma.job.update({
    where: { id: job.id },
    data: {
      bookedStart: start,
      bookedEnd: end,
      calendarEventId: eventId,
      status: JobStatus.BOOKED,
    },
  });
  await markJobNotificationsRead(job.id);
  await syncJobGmailLabelById(job.id);

  revalidatePath("/");
  revalidatePath("/notifications");
  revalidatePath(`/jobs/${job.id}`);
  revalidatePath(`/jobs/${job.id}/book`);

  if (demo) {
    return {
      ok: true,
      eventId,
      message:
        "Booked on the job board and a confirmation draft is ready to preview. Connect Google to write this onto Calendar and into Gmail Drafts.",
    };
  }

  return {
    ok: true,
    eventId,
    message:
      "Calendar event created. A confirmation email draft is waiting in Gmail — it has not been sent.",
  };
}
