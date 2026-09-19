import type { gmail_v1 } from "googleapis";
import { JobStatus } from "@prisma/client";
import { isDemoMode } from "./env";
import { getGmail } from "./google";
import { prisma } from "./prisma";

export const DESK_LABELS = [
  {
    key: "quote_request",
    name: "Quote request",
    help: "Needs quote / new quote request",
  },
  {
    key: "awaiting_customer",
    name: "Awaiting customer",
    help: "Quote sent, waiting on a reply",
  },
  {
    key: "ready_to_book",
    name: "Ready to book",
    help: "Customer accepted / picking a slot",
  },
  {
    key: "booked",
    name: "Booked",
    help: "Calendar event confirmed",
  },
  {
    key: "follow_up_review",
    name: "Follow-up / Review",
    help: "Stalled follow-up or post-job review ask",
  },
] as const;

export type DeskLabelKey = (typeof DESK_LABELS)[number]["key"];

export type LabelSyncResult = {
  ok: boolean;
  applied?: string | null;
  reason: string;
};

type JobLabelInput = {
  status: JobStatus;
  followUpSentAt?: Date | null;
  reviewAskSentAt?: Date | null;
  gmailThreadId?: string | null;
  threadId?: string | null;
};

export function deskLabelName(key: DeskLabelKey) {
  return DESK_LABELS.find((label) => label.key === key)?.name ?? key;
}

function normaliseLabel(name: string) {
  return name
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function namesMatchDeskLabel(existing: string, wanted: string) {
  const left = normaliseLabel(existing);
  const right = normaliseLabel(wanted);
  if (left === right) return true;
  return left.endsWith(` ${right}`) || left.endsWith(`/${right}`);
}

export function labelKeyForJob(job: JobLabelInput): DeskLabelKey {
  if (job.status === JobStatus.DONE || job.reviewAskSentAt) {
    return "follow_up_review";
  }
  if (job.status === JobStatus.BOOKED) return "booked";
  if (job.status === JobStatus.READY_TO_BOOK) return "ready_to_book";
  if (job.status === JobStatus.AWAITING_CUSTOMER) {
    return job.followUpSentAt ? "follow_up_review" : "awaiting_customer";
  }
  return "quote_request";
}

export function statusFromDeskLabel(key: DeskLabelKey): JobStatus {
  switch (key) {
    case "awaiting_customer":
      return JobStatus.AWAITING_CUSTOMER;
    case "ready_to_book":
      return JobStatus.READY_TO_BOOK;
    case "booked":
      return JobStatus.BOOKED;
    case "follow_up_review":
      return JobStatus.AWAITING_CUSTOMER;
    case "quote_request":
    default:
      return JobStatus.NEEDS_QUOTE;
  }
}

const SEED_PRIORITY: DeskLabelKey[] = [
  "booked",
  "ready_to_book",
  "follow_up_review",
  "awaiting_customer",
  "quote_request",
];

export function pickDeskLabel(keys: DeskLabelKey[]): DeskLabelKey | null {
  for (const key of SEED_PRIORITY) {
    if (keys.includes(key)) return key;
  }
  return null;
}

export function gmailThreadIdForSync(job: JobLabelInput) {
  const id = job.gmailThreadId || job.threadId || "";
  if (!id || id.startsWith("demo-")) return null;
  return id;
}

export async function ensureDeskLabels(
  gmail: gmail_v1.Gmail,
): Promise<Record<DeskLabelKey, { id: string; name: string }>> {
  const listed = await gmail.users.labels.list({ userId: "me" });
  const existing = listed.data.labels ?? [];
  const resolved = {} as Record<DeskLabelKey, { id: string; name: string }>;

  for (const desk of DESK_LABELS) {
    const match = existing.find(
      (label) => label.name && namesMatchDeskLabel(label.name, desk.name),
    );
    if (match?.id) {
      resolved[desk.key] = { id: match.id, name: match.name ?? desk.name };
      continue;
    }
    const created = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name: desk.name,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });
    if (!created.data.id) {
      throw new Error(`Could not create Gmail label ${desk.name}`);
    }
    resolved[desk.key] = { id: created.data.id, name: desk.name };
  }

  return resolved;
}

export function deskKeysFromLabelIds(
  labelIds: string[],
  resolved: Record<DeskLabelKey, { id: string; name: string }>,
): DeskLabelKey[] {
  const keys: DeskLabelKey[] = [];
  for (const desk of DESK_LABELS) {
    if (labelIds.includes(resolved[desk.key].id)) keys.push(desk.key);
  }
  return keys;
}

export async function syncJobGmailLabel(
  job: JobLabelInput,
): Promise<LabelSyncResult> {
  if (isDemoMode()) {
    return {
      ok: true,
      applied: deskLabelName(labelKeyForJob(job)),
      reason: "demo — Gmail labels are not written",
    };
  }

  const threadId = gmailThreadIdForSync(job);
  if (!threadId) {
    return { ok: true, applied: null, reason: "no live Gmail thread" };
  }

  const gmail = await getGmail();
  if (!gmail) {
    return { ok: true, applied: null, reason: "Gmail not connected" };
  }

  try {
    const resolved = await ensureDeskLabels(gmail);
    const wanted = labelKeyForJob(job);
    const addId = resolved[wanted].id;
    const removeLabelIds = DESK_LABELS.filter((label) => label.key !== wanted)
      .map((label) => resolved[label.key].id)
      .filter(Boolean);

    await gmail.users.threads.modify({
      userId: "me",
      id: threadId,
      requestBody: {
        addLabelIds: [addId],
        removeLabelIds,
      },
    });

    return {
      ok: true,
      applied: resolved[wanted].name,
      reason: "thread labelled",
    };
  } catch (error) {
    return {
      ok: false,
      applied: null,
      reason:
        error instanceof Error ? error.message : "Gmail label sync failed",
    };
  }
}

export async function syncJobGmailLabelById(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return { ok: false, reason: "job not found" } satisfies LabelSyncResult;
  return syncJobGmailLabel(job);
}
