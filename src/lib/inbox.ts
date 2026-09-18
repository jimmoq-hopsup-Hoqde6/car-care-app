import { MARKETING_SENDERS } from "./constants";
import { getGmail } from "./google";
import { prisma } from "./prisma";

export type InboxKind =
  | "quote_request"
  | "website_form"
  | "booking_negotiation"
  | "time_confirmation"
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
};

const KIND_LABELS: Record<InboxKind, string> = {
  quote_request: "New quote request",
  website_form: "Website form lead",
  booking_negotiation: "Booking negotiation",
  time_confirmation: "Needs time confirmation",
  marketing: "Marketing — ignore",
  other: "Other",
};

export function kindLabel(kind: InboxKind) {
  return KIND_LABELS[kind];
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
  if (
    /\b(yes|wednesday|thursday|friday|tuesday|monday|afternoon|morning|that works|book me)\b/.test(
      haystack,
    ) &&
    /\b(confirm|fine|works|book|wednesday|afternoon|morning)\b/.test(haystack)
  ) {
    if (haystack.includes("confirm") || haystack.includes("fine")) {
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

export function demoInboxThreads(): InboxThread[] {
  return [
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
    {
      id: "demo-thread-nathan",
      from: "Nathan Crowe <nathan.crowe@example.com>",
      fromEmail: "nathan.crowe@example.com",
      subject: "Re: Quote — Mitsubishi Outlander — Unley",
      snippet:
        "Thanks Marcel. When are you free over the next fortnight? After 1pm is easier.",
      kind: "booking_negotiation",
      ignored: false,
      jobId: "job-nathan",
    },
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
    threads.push({
      id: thread.id,
      from,
      fromEmail,
      subject,
      snippet,
      kind,
      ignored: kind === "marketing",
      jobId: job?.id ?? null,
    });
  }

  return threads;
}
