import { JobStatus } from "@prisma/client";
import { MARKETING_SENDERS } from "./constants";
import { isCustomerReplyEmail, isNonCustomerSender, isOwnBusinessEmail, resolveInboxCustomer } from "./customer-mail";
import {
  type DeskLabelKey,
  deskKeysFromLabelIds,
  deskLabelName,
  ensureDeskLabels,
  pickDeskLabel,
  statusFromDeskLabel,
} from "./gmail-labels";
import { getGmail } from "./google";
import { isDemoMode } from "./env";
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
  replyTo?: string | null;
  subject: string;
  snippet: string;
  bodyText?: string | null;
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

/** Kinds that land on the board without a tap. Marketing is never in this list. */
export const AUTO_IMPORT_KINDS: InboxKind[] = [
  "quote_request",
  "website_form",
  "booking_negotiation",
  "time_confirmation",
  "sms",
];

export function isEligibleForAutoImport(
  thread: Pick<InboxThread, "kind" | "ignored" | "deskLabel"> & {
    fromEmail?: string | null;
  },
) {
  if (thread.ignored || thread.kind === "marketing") return false;
  if (thread.kind === "sms") return true;
  if (thread.fromEmail !== undefined) {
    const from = thread.fromEmail;
    if (from && !isCustomerReplyEmail(from)) {
      // Website forms are mailed from info@; the customer is Reply-To / body.
      if (!(thread.kind === "website_form" && isOwnBusinessEmail(from))) {
        return false;
      }
    }
  }
  if (AUTO_IMPORT_KINDS.includes(thread.kind)) return true;
  // Similar in-scope customer work: already has a job-desk Gmail label.
  return Boolean(thread.deskLabel);
}

export function friendlyInboxError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error ?? "");
  if (/invalid_grant|unauthorized|unauthenticated|401|403|invalid_client|token/i.test(text)) {
    return "Gmail access expired or was refused. Reconnect Google in Settings, then open Inbox again.";
  }
  if (/network|fetch|ENOTFOUND|ECONN|timeout/i.test(text)) {
    return "Gmail could not be reached just now. Check the connection and try Inbox again.";
  }
  return "Gmail could not be loaded. Reconnect Google in Settings if this keeps happening.";
}

export type InboxListResult = {
  threads: InboxThread[];
  source: "gmail" | "demo";
  error?: string;
};

export function classifyThread(input: {
  from: string;
  subject: string;
  snippet: string;
}): InboxKind {
  const haystack = `${input.from} ${input.subject} ${input.snippet}`.toLowerCase();
  const fromEmail = extractEmail(input.from);
  const systemSender = isNonCustomerSender(fromEmail);
  const ownSender = isOwnBusinessEmail(fromEmail);
  if (MARKETING_SENDERS.some((part) => haystack.includes(part))) {
    return "marketing";
  }
  const looksLikeWebsiteForm =
    haystack.includes("website") ||
    haystack.includes("contact form") ||
    haystack.includes("enquiry from") ||
    haystack.includes("new quote request") ||
    haystack.includes("quote request") ||
    haystack.includes("customer details") ||
    (/(?:^|\n)\s*(?:full )?name\s*[:\-]/i.test(`${input.subject}\n${input.snippet}`) &&
      /(?:^|\n)\s*(?:e-?mail|customer e-?mail)\s*[:\-]/i.test(
        `${input.subject}\n${input.snippet}`,
      ));
  if (looksLikeWebsiteForm) {
    return "website_form";
  }
  if (systemSender || ownSender) {
    return "marketing";
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

type GmailPart = {
  mimeType?: string | null;
  body?: { data?: string | null };
  parts?: GmailPart[] | null;
};

function decodeGmailText(payload?: GmailPart | null): string {
  if (!payload) return "";
  const chunks: string[] = [];
  const walk = (part?: GmailPart | null) => {
    if (!part) return;
    const mime = (part.mimeType ?? "").toLowerCase();
    const skip =
      mime.startsWith("image/") ||
      mime.startsWith("application/") ||
      mime.includes("multipart");
    if (part.body?.data && !skip) {
      try {
        chunks.push(Buffer.from(part.body.data, "base64url").toString("utf8"));
      } catch {
        // ignore a bad part; other parts may still parse
      }
    }
    for (const child of part.parts ?? []) walk(child);
  };
  walk(payload);
  return chunks
    .join("\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
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
      id: "demo-thread-kai",
      from: "Kai Bennett <kai.bennett@example.com>",
      fromEmail: "kai.bennett@example.com",
      subject: "Quote — rear bumper scratch, Magill",
      snippet:
        "Hi, rear bumper scratch on a Mazda CX-5 in Magill. Can you quote?",
      kind: "quote_request",
      ignored: false,
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

async function listGmailThreads(): Promise<InboxThread[]> {
  const gmail = await getGmail();
  if (!gmail) {
    throw new Error("Gmail is not connected");
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
    try {
      const detail = await gmail.users.threads.get({
        userId: "me",
        id: thread.id,
        format: "full",
      });
      const headers = detail.data.messages?.[0]?.payload?.headers ?? [];
      const from =
        headers.find((header) => header.name?.toLowerCase() === "from")?.value ??
        "";
      const replyTo =
        headers.find((header) => header.name?.toLowerCase() === "reply-to")
          ?.value ?? "";
      const subject =
        headers.find((header) => header.name?.toLowerCase() === "subject")
          ?.value ?? "(no subject)";
      const snippet = detail.data.messages?.[0]?.snippet ?? "";
      const bodyText = decodeGmailText(
        detail.data.messages?.[0]?.payload as GmailPart | undefined,
      );
      const kind = classifyThread({
        from,
        subject,
        snippet: `${snippet}\n${bodyText}`,
      });
      const rawFromEmail = extractEmail(from);
      const customer = resolveInboxCustomer({
        from,
        fromEmail: rawFromEmail,
        replyTo,
        subject,
        snippet: `${snippet}\n${bodyText}`,
      });
      const fromEmail = customer.email || rawFromEmail;
      const job = jobs.find((row) => {
        if (row.gmailThreadId === thread.id || row.threadId === thread.id) {
          return true;
        }
        if (!isCustomerReplyEmail(fromEmail) || !row.customerEmail) return false;
        return row.customerEmail.toLowerCase() === fromEmail;
      });
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
            from:
              customer.name && customer.email
                ? `${customer.name} <${customer.email}>`
                : from,
            fromEmail,
            replyTo,
            subject,
            snippet,
            bodyText,
            kind,
            ignored: kind === "marketing",
            jobId: job?.id ?? null,
          },
          deskLabel,
        ),
      );
    } catch {
      // Skip a single bad thread; do not fail the whole inbox.
    }
  }

  return threads;
}

export async function loadInbox(): Promise<InboxListResult> {
  try {
    const gmail = await getGmail();
    if (!gmail) {
      if (isDemoMode()) {
        return { threads: demoInboxThreads(), source: "demo" };
      }
      return {
        threads: [],
        source: "gmail",
        error:
          "Gmail is not connected. Connect Google in Settings, then tap Sync inbox now.",
      };
    }
    const threads = await listGmailThreads();
    return { threads, source: "gmail" };
  } catch (error) {
    return {
      threads: [],
      source: "gmail",
      error: friendlyInboxError(error),
    };
  }
}

export async function listInboxThreads(): Promise<InboxThread[]> {
  return (await loadInbox()).threads;
}
