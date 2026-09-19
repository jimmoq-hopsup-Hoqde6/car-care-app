import { JobStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingPicker } from "@/components/BookingPicker";
import { PhotoGallery } from "@/components/PhotoGallery";
import { jobEventTitle, listAvailableSlots } from "@/lib/booking";
import { prisma } from "@/lib/prisma";
import { recommendSlots } from "@/lib/recommendations";

export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let job;
  try {
    job = await prisma.job.findUnique({
      where: { id },
      include: { photos: true },
    });
  } catch {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-xl font-semibold text-ink">Booking could not load</h1>
        <p className="mt-2 text-sm text-stone-700">
          The database may be unreachable. Nothing was sent.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex min-h-11 items-center rounded-full bg-teal px-4 py-2.5 text-sm font-semibold text-ink"
        >
          Job board
        </Link>
      </div>
    );
  }
  if (!job) notFound();
  let openSlots: Awaited<ReturnType<typeof listAvailableSlots>> = [];
  let bookedJobs: Array<{
    id: string;
    customerName: string;
    suburb: string | null;
    bookedStart: Date | null;
    bookedEnd: Date | null;
  }> = [];
  let calendarNote: string | null = null;
  try {
    [openSlots, bookedJobs] = await Promise.all([
      listAvailableSlots(14),
      prisma.job.findMany({
        where: {
          status: { in: [JobStatus.BOOKED, JobStatus.DONE] },
          bookedStart: { not: null },
          id: { not: job.id },
        },
        select: {
          id: true,
          customerName: true,
          suburb: true,
          bookedStart: true,
          bookedEnd: true,
        },
      }),
    ]);
  } catch {
    calendarNote =
      "Calendar could not be reached. Reconnect Google in Settings if this keeps happening. You can still pick a slot from weekdays on the board.";
    openSlots = [];
    bookedJobs = [];
  }

  const ranked = recommendSlots(
    job.suburb,
    openSlots,
    bookedJobs.filter(
      (row): row is typeof row & { bookedStart: Date; bookedEnd: Date } =>
        Boolean(row.bookedStart && row.bookedEnd),
    ),
  );
  const recommendedIds = new Set(
    ranked.filter((slot) => slot.recommended).map((slot) => slot.startIso),
  );
  const slots = openSlots.map((slot) => {
    const match = ranked.find((row) => row.startIso === slot.startIso);
    if (!match) return slot;
    return {
      ...slot,
      recommended: recommendedIds.has(slot.startIso),
      recommendReason: match.recommendReason,
      recommendRank: match.recommendRank,
    };
  });

  return (
    <div className="space-y-5">
      <Link href={`/jobs/${job.id}`} className="text-sm font-medium text-teal-dark">
        ← {job.customerName}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-ink">Pick a booking</h1>
        <p className="text-sm text-stone-600">
          Free slots for the next 14 days, Adelaide time. Default job length is 3
          hours. Recommended times sit near other jobs the same day. Confirmation
          drafts never send themselves.
        </p>
        {calendarNote ? (
          <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-ink">
            {calendarNote}
          </p>
        ) : null}
      </div>
      <PhotoGallery jobId={job.id} photos={job.photos} compact />
      <BookingPicker job={job} slots={slots} eventTitle={jobEventTitle(job)} />
    </div>
  );
}
