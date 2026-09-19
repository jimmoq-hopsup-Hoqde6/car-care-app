import { STATUS_LABELS, type JobStatusValue } from "@/lib/constants";

const styles: Record<JobStatusValue, string> = {
  NEEDS_QUOTE: "bg-amber-100 text-amber-900",
  AWAITING_CUSTOMER: "bg-sky-100 text-sky-900",
  READY_TO_BOOK: "bg-teal/20 text-teal-dark",
  BOOKED: "bg-indigo-100 text-indigo-900",
  DONE: "bg-stone-200 text-stone-800",
};

export function StatusBadge({ status }: { status: JobStatusValue }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
