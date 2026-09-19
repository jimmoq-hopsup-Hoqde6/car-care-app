import { JobStatus } from "@prisma/client";
import {
  looksLikeBookingConfirmation,
  looksLikeBookingRequest,
} from "./booking-ops";
import { MARKETING_SENDERS } from "./constants";
import {
  isCustomerReplyEmail,
  isOwnBusinessEmail,
  isSystemMailSender,
  resolveInboxCustomer,
} from "./customer-mail";
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

/** Never create a board card for Google alerts, Sinch, no-reply, or info@ without a customer. */
export function canImportThreadToBoard(thread: InboxThread) {
  if (thread.kind === "marketing" || thread.ignored) return false;
  if (thread.kind === "sms") return true;
  if (
    isSystemMailSender({ from: thread.from, fromEmail: thread.fromEmail }) &&
    !(thread.kind === "website_form" && isOwnBusinessEmail(thread.fromEmail))
  ) {
    return false;
  }
  const customer = resolveInboxCustomer({
    from: thread.from,
    fromEmail: thread.fromEmail,
    replyTo: thread.replyTo,
    subject: thread.subject,
    snippet: `${thread.snippet}\n${thread.bodyText ?? ""}`,
  });
  return Boolean(customer.email) && !customer.ignored;
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }
  const workers = Math.max(0, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
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
    from?: string | null;
    replyTo?: string | null;
  },
) {
  if (thread.ignored || thread.kind === "marketing") return false;
  if (thread.kind === "sms") return true;
  if (
    isSystemMailSender({ from: thread.from, fromEmail: thread.fromEmail }) &&
    !(thread.kind === "website_form" && isOwnBusinessEmail(thread.fromEmail))
  ) {
    return false;
  }
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
  const systemSender = isSystemMailSender({ from: input.from, fromEmail });
  const ownSender = isOwnBusinessEmail(fromEmail);
  if (systemSender && !ownSender) {
    return "marketing";
  }
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
  if (ownSender) {
    return "marketing";
  }
  if (looksLikeBookingConfirmation(`${input.subject}\n${input.snippet}`)) {
    return "time_confirmation";
  }
  if (looksLikeBookingRequest(`${input.subject}\n${input.snippet}`)) {
    return "booking_negotiation";
  }
  const bookingIntent =
    /\b(yes|wednesday|thursday|friday|tuesday|monday|saturday|sunday|afternoon|morning|that works|book me|book in|booking|available|fortnight|sounds good|go ahead|happy to|lock in|please book|when are you free|can we book)\b/.test(
      haystack,
    );
  const bookingConfirm =
    /\b(confirm|fine|works|book|wednesday|thursday|friday|tuesday|monday|saturday|sunday|afternoon|morning|free|available)\b/.test(
      haystack,
    );
  if (bookingIntent && bookingConfirm) {
    if (
      haystack.includes("confirm") ||
      haystack.includes("fine") ||
      haystack.includes("yes,") ||
      haystack.includes("saturday") ||
      haystack.includes("sunday")
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

function headerValue(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  name: string,
) {
  return (
    headers?.find((header) => header.name?.toLowerCase() === name)?.value ?? ""
  );
}

/** Newest customer message — Gmail threads.get is oldest-first, so [0] is the original. */
export function pickLatestCustomerMessage(
  messages: Array<{
    snippet?: string | null;
    internalDate?: string | null;
    payload?: {
      headers?: Array<{ name?: string | null; value?: string | null }>;
      mimeType?: string | null;
      body?: { data?: string | null };
      parts?: GmailPart[] | null;
    } | null;
  }>,
) {
  const ranked = [...messages].sort(
    (a, b) => Number(b.internalDate ?? 0) - Number(a.internalDate ?? 0),
  );
  for (const message of ranked) {
    const from = headerValue(message.payload?.headers, "from");
    const email = extractEmail(from);
    if (isOwnBusinessEmail(email) || isSystemMailSender({ from, fromEmail: email })) {
      continue;
    }
    if (email && !isCustomerReplyEmail(email)) continue;
    if (!from && !email) continue;
    return {
      from,
      email,
      snippet: message.snippet ?? "",
      bodyText: decodeGmailText(message.payload as GmailPart | undefined),
      replyTo: headerValue(message.payload?.headers, "reply-to"),
      subject: headerValue(message.payload?.headers, "subject"),
    };
  }
  return null;
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
        id: "demo-thread-darren",
        from: "Darren Buckney <darren.buckney@example.com>",
        fromEmail: "darren.buckney@example.com",
        subject: "Re: Quote — Mazda CX-5 — Prospect",
        snippet:
          "Yes Saturday morning works. Book me in. Address is 14 Main North Road, Prospect.",
        kind: "time_confirmation",
        ignored: false,
        jobId: "job-darren",
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

export type InboxLoadOptions = {
  maxResults?: number;
  skipDeskLabels?: boolean;
};

const GMAIL_GET_CONCURRENCY = 6;

async function listGmailThreads(
  options?: InboxLoadOptions,
): Promise<InboxThread[]> {
  const gmail = await getGmail();
  if (!gmail) {
    throw new Error("Gmail is not connected");
  }

  const maxResults = Math.max(1, Math.min(options?.maxResults ?? 25, 25));
  const listed = await gmail.users.threads.list({
    userId: "me",
    q: "newer_than:45d",
    maxResults,
  });

  const jobs = await prisma.job.findMany({
    select: { id: true, customerEmail: true, threadId: true, gmailThreadId: true },
  });

  let resolved: Awaited<ReturnType<typeof ensureDeskLabels>> | null = null;
  if (!options?.skipDeskLabels) {
    try {
      resolved = await ensureDeskLabels(gmail);
    } catch {
      resolved = null;
    }
  }

  const listedThreads = (listed.data.threads ?? []).filter(
    (thread): thread is { id: string } => Boolean(thread.id),
  );

  const mapped = await mapWithConcurrency(
    listedThreads,
    GMAIL_GET_CONCURRENCY,
    async (thread) => {
      try {
        const detail = await gmail.users.threads.get({
          userId: "me",
          id: thread.id,
          format: "full",
        });
        const messages = detail.data.messages ?? [];
        const first = messages[0];
        const headers = first?.payload?.headers ?? [];
        const firstFrom = headerValue(headers, "from");
        const firstReplyTo = headerValue(headers, "reply-to");
        const subject =
          headerValue(headers, "subject") ||
          headerValue(messages.at(-1)?.payload?.headers, "subject") ||
          "(no subject)";
        const latest = pickLatestCustomerMessage(messages);
        const from = latest?.from || firstFrom;
        const replyTo = latest?.replyTo || firstReplyTo;
        const snippet = latest?.snippet || first?.snippet || "";
        const bodyText =
          latest?.bodyText ||
          decodeGmailText(first?.payload as GmailPart | undefined);
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
        const systemFrom = isSystemMailSender({ from, fromEmail: rawFromEmail });
        const fromEmail =
          systemFrom && !isOwnBusinessEmail(rawFromEmail)
            ? rawFromEmail
            : customer.email || latest?.email || rawFromEmail;
        const job = jobs.find((row) => {
          if (row.gmailThreadId === thread.id || row.threadId === thread.id) {
            return true;
          }
          const matchEmail = latest?.email || fromEmail;
          if (!isCustomerReplyEmail(matchEmail) || !row.customerEmail) return false;
          return row.customerEmail.toLowerCase() === matchEmail;
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
        const ignored =
          kind === "marketing" ||
          (systemFrom && !isOwnBusinessEmail(rawFromEmail)) ||
          (customer.ignored && !isOwnBusinessEmail(rawFromEmail));
        return withDeskLabel(
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
            ignored,
            jobId: job?.id ?? null,
          },
          deskLabel,
        );
      } catch {
        return null;
      }
    },
  );

  return mapped.filter((thread): thread is InboxThread => thread !== null);
}

export async function loadInbox(
  options?: InboxLoadOptions,
): Promise<InboxListResult> {
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
    const threads = await listGmailThreads(options);
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
