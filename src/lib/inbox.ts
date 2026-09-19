import { JobStatus } from "@prisma/client";
import { MARKETING_SENDERS } from "./constants";
import {
  type DeskLabelKey,
  deskKeysFromLabelIds,
  deskLabelName,
  ensureDeskLabels,
  pickDeskLabel,
  statusFromDeskLabel,
} from "./gmail-labels";
import { getGmail } from "./google";
import { prisma } from "./prisma";

export type InboxKind =
  | "quote_request"
  | "website_form"
  | "booking_negotiation"
  | "time_confirmation"
  | "sms"
  | "marketing"
  | "other";

export type InboxThread = {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  kind: InboxKind;
  ignored: boolean;
  jobId?: string | null;
  deskLabel?: DeskLabelKey | null;
  deskLabelName?: string | null;
  seedStatus?: JobStatus | null;
};

const KIND_LABELS: Record<InboxKind, string> = {
  quote_request: "New quote request",
  website_form: "Website form lead",
  sms: "SMS",
  booking_negotiation: "Booking negotiation",
  time_confirmation: "Needs time confirmation",
  marketing: "Marketing — ignore",
  other: "Other",
};

export function kindLabel(kind: InboxKind) {
  return KIND_LABELS[kind];
}

export function needsBookingApproval(kind: InboxKind) {
  return kind === "booking_negotiation" || kind === "time_confirmation";
}

export function classifyThread(input: {
  from: string;
  subject: string;
  snippet: string;
}): InboxKind {
  const haystack = `${input.from} ${input.subject} ${input.snippet}`.toLowerCase();
  if (MARKETING_SENDERS.some((part) => haystack.includes(part))) {
    return "marketing";
  }
  if (
    haystack.includes("website") ||
    haystack.includes("contact form") ||
    haystack.includes("enquiry from")
  ) {
    return "website_form";
  }
  const bookingIntent =
    /\b(yes|wednesday|thursday|friday|tuesday|monday|afternoon|morning|that works|book me|book in|booking|available|fortnight|sounds good|go ahead|happy to|lock in|please book|when are you free|can we book)\b/.test(
      haystack,
    );
  const bookingConfirm =
    /\b(confirm|fine|works|book|wednesday|thursday|friday|tuesday|monday|afternoon|morning|free|available)\b/.test(
      haystack,
    );
  if (bookingIntent && bookingConfirm) {
    if (
      haystack.includes("confirm") ||
      haystack.includes("fine") ||
      haystack.includes("yes,")
    ) {
      return "time_confirmation";
    }
    return "booking_negotiation";
  }
  if (
    haystack.includes("scratch") ||
    haystack.includes("bumper") ||
    haystack.includes("dent") ||
    haystack.includes("quote") ||
    haystack.includes("repair")
  ) {
    return "quote_request";
  }
  return "other";
}

function extractEmail(from: string) {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim().toLowerCase();
}

function withDeskLabel(
  thread: InboxThread,
  key: DeskLabelKey | null,
): InboxThread {
  if (!key) return thread;
  return {
    ...thread,
    deskLabel: key,
    deskLabelName: deskLabelName(key),
    seedStatus: statusFromDeskLabel(key),
  };
}

export function demoInboxThreads(): InboxThread[] {
  return [
    withDeskLabel(
      {
        id: "demo-thread-jenny",
        from: "Jenny Gwynne <jenny.gwynne@example.com>",
        fromEmail: "jenny.gwynne@example.com",
        subject: "Website enquiry — BMW bumper scratch, Crafers",
        snippet:
          "Hi, I submitted the form on your website. Car park scrape on the BMW bumper. Photos attached. Jenny",
        kind: "website_form",
        ignored: false,
        jobId: "job-jenny",
      },
      "quote_request",
    ),
    withDeskLabel(
      {
        id: "demo-thread-nathan",
        from: "Nathan Crowe <nathan.crowe@example.com>",
        fromEmail: "nathan.crowe@example.com",
        subject: "Re: Quote — Mitsubishi Outlander — Unley",
        snippet:
          "Thanks Marcel. I'll check with my wife and come back to you on the quote.",
        kind: "other",
        ignored: false,
        jobId: "job-nathan",
      },
      "awaiting_customer",
    ),
    withDeskLabel(
      {
        id: "demo-thread-john",
        from: "John Hale <john.hale@example.com>",
        fromEmail: "john.hale@example.com",
        subject: "Re: Quote — Honda CR-V — Glenelg",
        snippet: "Yes, Wednesday afternoon is fine.",
        kind: "time_confirmation",
        ignored: false,
        jobId: "job-john",
      },
      "ready_to_book",
    ),
    withDeskLabel(
      {
        id: "demo-thread-mia",
        from: "Mia Chen <mia.chen@example.com>",
        fromEmail: "mia.chen@example.com",
        subject: "Re: Quote — Toyota Corolla — Goodwood",
        snippet: "Happy with the quote — can you book me in next week after 1pm?",
        kind: "booking_negotiation",
        ignored: false,
        jobId: "job-mia",
      },
      "ready_to_book",
    ),
    withDeskLabel(
      {
        id: "demo-thread-jamie",
        from: "Jamie Collis <jamie_collis@outlook.com>",
        fromEmail: "jamie_collis@outlook.com",
        subject: "Website enquiry — panel repair, Paradise",
        snippet:
          "Scratches on bonnet, ceramic coating has been applied prior to damage. No photos uploaded.",
        kind: "website_form",
        ignored: false,
        jobId: "job-jamie",
      },
      "quote_request",
    ),
    {
      id: "demo-thread-taylor",
      from: "Taylor Nguyen <0411 555 019>",
      fromEmail: "",
      subject: "SMS — driver door scratch, Prospect",
      snippet:
        "Hi, got a scratch on the driver door in Prospect. Can you quote?",
      kind: "sms",
      ignored: false,
      jobId: "job-taylor",
    },
    withDeskLabel(
      {
        id: "demo-thread-alex",
        from: "Alex Rowe <alex.rowe@example.com>",
        fromEmail: "alex.rowe@example.com",
        subject: "Website enquiry — bumper and guard, Payneham",
        snippet:
          "Front bumper and passenger guard both need repair and paint after a car park hit. Photos attached.",
        kind: "website_form",
        ignored: false,
        jobId: "job-alex",
      },
      "quote_request",
    ),
    withDeskLabel(
      {
        id: "demo-thread-sam",
        from: "Sam Vella <sam.vella@example.com>",
        fromEmail: "sam.vella@example.com",
        subject: "Website enquiry — door scratch, Norwood",
        snippet: "Long scratch on the driver door. No photos uploaded.",
        kind: "website_form",
        ignored: false,
        jobId: "job-sam",
      },
      "quote_request",
    ),
    {
      id: "demo-thread-manheim",
      from: "Manheim <noreply@manheim.com.au>",
      fromEmail: "noreply@manheim.com.au",
      subject: "This week's auction highlights",
      snippet: "Don't miss this week's wholesale auction listings...",
      kind: "marketing",
      ignored: true,
    },
  ];
}

export async function listInboxThreads(): Promise<InboxThread[]> {
  const gmail = await getGmail();
  if (!gmail) {
    return demoInboxThreads();
  }

  const listed = await gmail.users.threads.list({
    userId: "me",
    q: "newer_than:45d",
    maxResults: 25,
  });

  const jobs = await prisma.job.findMany({
    select: { id: true, customerEmail: true, threadId: true, gmailThreadId: true },
  });

  let resolved: Awaited<ReturnType<typeof ensureDeskLabels>> | null = null;
  try {
    resolved = await ensureDeskLabels(gmail);
  } catch {
    resolved = null;
  }

  const threads: InboxThread[] = [];
  for (const thread of listed.data.threads ?? []) {
    if (!thread.id) continue;
    const detail = await gmail.users.threads.get({
      userId: "me",
      id: thread.id,
      format: "metadata",
      metadataHeaders: ["From", "Subject"],
    });
    const headers = detail.data.messages?.[0]?.payload?.headers ?? [];
    const from =
      headers.find((header) => header.name?.toLowerCase() === "from")?.value ??
      "";
    const subject =
      headers.find((header) => header.name?.toLowerCase() === "subject")
        ?.value ?? "(no subject)";
    const snippet = detail.data.messages?.[0]?.snippet ?? "";
    const kind = classifyThread({ from, subject, snippet });
    const fromEmail = extractEmail(from);
    const job = jobs.find(
      (row) =>
        row.gmailThreadId === thread.id ||
        row.threadId === thread.id ||
        row.customerEmail?.toLowerCase() === fromEmail,
    );
    const labelIds = [
      ...new Set(
        (detail.data.messages ?? []).flatMap(
          (message) => message.labelIds ?? [],
        ),
      ),
    ];
    const deskLabel = resolved
      ? pickDeskLabel(deskKeysFromLabelIds(labelIds, resolved))
      : null;
    threads.push(
      withDeskLabel(
        {
          id: thread.id,
          from,
          fromEmail,
          subject,
          snippet,
          kind,
          ignored: kind === "marketing",
          jobId: job?.id ?? null,
        },
        deskLabel,
      ),
    );
  }

  return threads;
}
