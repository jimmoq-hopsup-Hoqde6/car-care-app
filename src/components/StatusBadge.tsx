import { STATUS_LABELS, type JobStatusValue } from "@/lib/constants";

const styles: Record<JobStatusValue, string> = {
  NEEDS_QUOTE: "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80",
  AWAITING_CUSTOMER: "bg-sky-50 text-sky-950 ring-1 ring-sky-200/80",
  READY_TO_BOOK: "bg-teal/15 text-teal-dark ring-1 ring-teal/30",
  BOOKED: "bg-indigo-50 text-indigo-950 ring-1 ring-indigo-200/80",
  DONE: "bg-stone-100 text-stone-700 ring-1 ring-stone-200",
};

export function StatusBadge({ status }: { status: JobStatusValue }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight ${styles[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
