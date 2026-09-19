export const ADELAIDE_TZ = "Australia/Adelaide";

/** Marcel's Google review link — default, still editable on Settings. */
export const DEFAULT_GOOGLE_REVIEW_URL =
  "https://maps.app.goo.gl/UJcUi9ouWQaVn71D8?g_st=ic";

/** Marcel's existing mobile — the only SMS number. */
export const OWNER_MOBILE =
  process.env.OWNER_MOBILE?.trim() || "0435222221";

export function formatOwnerMobile(mobile = OWNER_MOBILE) {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return mobile;
}

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
] as const;

export const JOB_STATUSES = [
  "NEEDS_QUOTE",
  "AWAITING_CUSTOMER",
  "READY_TO_BOOK",
  "BOOKED",
  "DONE",
] as const;

export type JobStatusValue = (typeof JOB_STATUSES)[number];

export const STATUS_LABELS: Record<JobStatusValue, string> = {
  NEEDS_QUOTE: "Needs quote",
  AWAITING_CUSTOMER: "Awaiting customer",
  READY_TO_BOOK: "Ready to book",
  BOOKED: "Booked",
  DONE: "Done",
};

export const STATUS_HELP: Record<JobStatusValue, string> = {
  NEEDS_QUOTE: "Photos or notes in — you still need to type a price",
  AWAITING_CUSTOMER: "Quote drafted or sent — waiting on a reply",
  READY_TO_BOOK: "Customer accepted — pick a free slot",
  BOOKED: "Calendar event created",
  DONE: "Repair finished",
};

export const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  website: "Website form",
  sms: "SMS",
};

export const MARKETING_SENDERS = ["manheim", "noreply@manheim", "auction@"];
