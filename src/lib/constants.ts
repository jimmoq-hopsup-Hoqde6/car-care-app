export const ADELAIDE_TZ = "Australia/Adelaide";

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
};

export const MARKETING_SENDERS = ["manheim", "noreply@manheim", "auction@"];
