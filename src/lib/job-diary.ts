import { asActivityDate, type DateLike } from "./activity";

export type DiaryKind = "note" | "sms" | "email" | "photo" | "booking" | "status";

export type DiaryItem = {
  id: string;
  at: Date;
  kind: DiaryKind;
  title: string;
  body?: string;
};

type DiaryJob = {
  createdAt?: DateLike;
  channel?: string | null;
  damageNotes?: string | null;
  quoteSentAt?: DateLike;
  photoAskSentAt?: DateLike;
  bookedStart?: DateLike;
  completedAt?: DateLike;
  lastCustomerReplyAt?: DateLike;
  photos?: Array<{ id: string; filename?: string | null; createdAt?: DateLike }>;
  smsMessages?: Array<{
    id: string;
    direction: string;
    body?: string | null;
    createdAt?: DateLike;
  }>;
  drafts?: Array<{
    id: string;
    type: string;
    subject?: string | null;
    body?: string | null;
    sentAt?: DateLike;
    createdAt?: DateLike;
  }>;
};

const DRAFT_TITLE: Record<string, string> = {
  quote: "Quote",
  confirmation: "Booking confirmation",
  photo_ask: "Photo ask",
  scope_decline: "Out-of-scope decline",
};

function stamp(value: DateLike, fallback?: DateLike) {
  return asActivityDate(value) ?? asActivityDate(fallback);
}

/** Newest-first diary from job fields (no extra tables). */
export function buildJobDiary(job: DiaryJob): DiaryItem[] {
  const items: DiaryItem[] = [];

  const created = stamp(job.createdAt);
  if (created) {
    items.push({
      id: "created",
      at: created,
      kind: "status",
      title: job.channel === "sms" ? "SMS job added" : "Job added",
    });
  }

  if (job.damageNotes?.trim()) {
    items.push({
      id: "notes",
      at: created ?? new Date(0),
      kind: "note",
      title: "Intake notes",
      body: job.damageNotes.trim(),
    });
  }

  for (const photo of job.photos ?? []) {
    const at = stamp(photo.createdAt, created);
    if (!at) continue;
    items.push({
      id: `photo-${photo.id}`,
      at,
      kind: "photo",
      title: "Damage photo",
      body: photo.filename?.replace(/[-_]/g, " ") || undefined,
    });
  }

  for (const sms of job.smsMessages ?? []) {
    const at = stamp(sms.createdAt);
    if (!at) continue;
    items.push({
      id: `sms-${sms.id}`,
      at,
      kind: "sms",
      title: sms.direction === "inbound" ? "Customer SMS" : "SMS sent",
      body: sms.body?.trim() || undefined,
    });
  }

  for (const draft of job.drafts ?? []) {
    const at = stamp(draft.sentAt, draft.createdAt);
    if (!at) continue;
    const label = DRAFT_TITLE[draft.type] ?? draft.type;
    items.push({
      id: `draft-${draft.id}`,
      at,
      kind: "email",
      title: draft.sentAt ? `${label} sent` : `${label} draft`,
      body: draft.subject || draft.body?.slice(0, 180) || undefined,
    });
  }

  const booked = stamp(job.bookedStart);
  if (booked) {
    items.push({
      id: "booked",
      at: booked,
      kind: "booking",
      title: "Calendar booking",
    });
  }

  const done = stamp(job.completedAt);
  if (done) {
    items.push({
      id: "done",
      at: done,
      kind: "status",
      title: "Marked done",
    });
  }

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items;
}
