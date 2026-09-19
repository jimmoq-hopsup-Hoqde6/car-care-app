import { formatLastActivity } from "@/lib/activity";
import type { DiaryItem } from "@/lib/job-diary";

const KIND_LABEL: Record<DiaryItem["kind"], string> = {
  note: "Note",
  sms: "SMS",
  email: "Email",
  photo: "Photo",
  booking: "Booking",
  status: "Status",
};

export function JobDiary({ items }: { items: DiaryItem[] }) {
  return (
    <section className="desk-card p-4">
      <h2 className="text-sm font-semibold text-ink">Activity</h2>
      <p className="mt-0.5 text-xs text-muted">
        Email, SMS, photos and status on this job — Adelaide time.
      </p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing on the diary yet.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="border-l-2 border-line pl-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                {KIND_LABEL[item.kind]} · {formatLastActivity(item.at)}
              </p>
              <p className="mt-0.5 font-medium text-ink">{item.title}</p>
              {item.body ? (
                <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap text-sm text-muted">
                  {item.body}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
