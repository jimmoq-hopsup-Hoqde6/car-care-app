import type { JobStatusValue } from "./constants";

/** Left-edge accent for kanban cards (Pipedrive / ServiceM8 stage cue). */
export const STATUS_EDGE: Record<JobStatusValue, string> = {
  NEEDS_QUOTE: "border-l-amber-400",
  AWAITING_CUSTOMER: "border-l-sky-400",
  READY_TO_BOOK: "border-l-teal",
  BOOKED: "border-l-indigo-400",
  DONE: "border-l-stone-300",
};

export const STATUS_COLUMN_DOT: Record<JobStatusValue, string> = {
  NEEDS_QUOTE: "bg-amber-400",
  AWAITING_CUSTOMER: "bg-sky-400",
  READY_TO_BOOK: "bg-teal",
  BOOKED: "bg-indigo-400",
  DONE: "bg-stone-300",
};
