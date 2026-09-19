import Link from "next/link";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/notifications";
import { formatAdelaide } from "@/lib/booking";
import { prisma } from "@/lib/prisma";

export default async function NotificationsPage() {
  const notes = await prisma.notification.findMany({
    orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
    include: { job: { select: { customerName: true, suburb: true } } },
  });
  const unread = notes.filter((note) => !note.readAt).length;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Notifications</h1>
          <p className="text-sm text-stone-600">
            These only tell you a customer is waiting. Quotes and bookings still
            need your tap — nothing is auto-sent.
          </p>
        </div>
        {unread > 0 ? (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold"
            >
              Mark all read
            </button>
          </form>
        ) : null}
      </div>

      {notes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-card p-6 text-sm text-stone-500">
          Nothing waiting. Booking replies will land here.
        </p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const href = note.href || (note.jobId ? `/jobs/${note.jobId}` : "/");
            return (
              <article
                key={note.id}
                className={`rounded-2xl border p-4 ${
                  note.readAt
                    ? "border-line bg-white/70"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <p className="text-xs uppercase tracking-wide text-stone-500">
                  {note.readAt ? "Read" : "Unread"} ·{" "}
                  {formatAdelaide(note.createdAt, "d MMM, h:mm a")}
                </p>
                <h2 className="mt-1 font-semibold text-ink">{note.title}</h2>
                <p className="mt-1 text-sm text-stone-600">{note.body}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={href}
                    className="rounded-full bg-teal px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Open booking
                  </Link>
                  {!note.readAt ? (
                    <form action={markNotificationRead.bind(null, note.id)}>
                      <button
                        type="submit"
                        className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold"
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
