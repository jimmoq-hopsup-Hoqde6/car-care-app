import Link from "next/link";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/notifications";
import { formatAdelaide } from "@/lib/booking";
import {
  bookingNextCta,
  forgottenReadyToBook,
  waitingSinceLabel,
} from "@/lib/booking-ops";
import { prisma } from "@/lib/prisma";

export default async function NotificationsPage() {
  let notes: Array<{
    id: string;
    title: string;
    body: string;
    href: string | null;
    jobId: string | null;
    readAt: Date | null;
    createdAt: Date;
    job: { customerName: string; suburb: string | null } | null;
  }> = [];
  try {
    notes = await prisma.notification.findMany({
      orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
      include: { job: { select: { customerName: true, suburb: true } } },
    });
  } catch {
    notes = [];
  }
  const unread = notes.filter((note) => !note.readAt).length;
  let forgotten: Awaited<ReturnType<typeof prisma.job.findMany>> = [];
  try {
    forgotten = forgottenReadyToBook(
      await prisma.job.findMany({
        where: { status: "READY_TO_BOOK" },
      }),
    );
  } catch {
    forgotten = [];
  }
  const forgottenIds = new Set(forgotten.map((job) => job.id));
  const extraNotes = notes.filter(
    (note) => !note.jobId || !forgottenIds.has(note.jobId),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Alerts
          </h1>
          <p className="mt-1 text-sm text-muted">
            Forgotten ready-to-books stay here until you pick a date. Quotes and
            booking confirms still need your tap — nothing is auto-sent.
          </p>
        </div>
        {unread > 0 ? (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="desk-btn border border-line bg-white text-ink"
            >
              Mark all read
            </button>
          </form>
        ) : null}
      </div>

      {forgotten.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900">
            Needs your reply — ready to book, no date
          </h2>
          {forgotten.map((job) => (
            <article
              key={job.id}
              className="desk-card border-amber-200 border-l-4 border-l-teal bg-amber-50 p-4"
            >
              <p className="text-xs uppercase tracking-wide text-muted">
                {waitingSinceLabel(job)}
                {job.suburb ? ` · ${job.suburb}` : ""}
              </p>
              <h3 className="mt-1 font-semibold tracking-tight text-ink">
                {job.customerName}
              </h3>
              <p className="mt-1 text-sm text-muted">
                Accepted or asked to book, and there is still no calendar event.
              </p>
              <Link
                href={`/jobs/${job.id}/book`}
                className="desk-btn mt-3 min-h-12 bg-teal text-ink"
              >
                {bookingNextCta(job)}
              </Link>
            </article>
          ))}
        </section>
      ) : null}

      {extraNotes.length === 0 && forgotten.length === 0 ? (
        <p className="desk-card border-dashed px-5 py-8 text-center text-sm text-muted">
          Nothing waiting. Booking replies and ready-to-book jobs with no date
          land here. Tap Sync inbox if the board looks empty.
        </p>
      ) : extraNotes.length === 0 ? null : (
        <div className="space-y-3">
          {extraNotes.map((note) => {
            const href = note.href || (note.jobId ? `/jobs/${note.jobId}` : "/");
            return (
              <article
                key={note.id}
                className={`desk-card p-4 ${
                  note.readAt
                    ? ""
                    : "border-amber-200 border-l-4 border-l-amber-400 bg-amber-50"
                }`}
              >
                <p className="text-xs uppercase tracking-wide text-muted">
                  {note.readAt ? "Read" : "Unread"} ·{" "}
                  {formatAdelaide(note.createdAt, "d MMM, h:mm a")}
                </p>
                <h2 className="mt-1 font-semibold tracking-tight text-ink">
                  {note.title}
                </h2>
                <p className="mt-1 text-sm text-muted">{note.body}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={href}
                    className="desk-btn min-h-12 bg-teal text-ink"
                  >
                    Open booking
                  </Link>
                  {!note.readAt ? (
                    <form action={markNotificationRead.bind(null, note.id)}>
                      <button
                        type="submit"
                        className="desk-btn border border-line bg-white text-ink"
                      >
                        Mark read
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
