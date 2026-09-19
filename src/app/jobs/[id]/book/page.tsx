import { JobStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingPicker } from "@/components/BookingPicker";
import { jobEventTitle, listAvailableSlots } from "@/lib/booking";
import { prisma } from "@/lib/prisma";
import { recommendSlots } from "@/lib/recommendations";

export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) notFound();
  const [openSlots, bookedJobs] = await Promise.all([
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
      <Link href={`/jobs/${job.id}`} className="text-sm text-teal">
        ← {job.customerName}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-ink">Pick a booking</h1>
        <p className="text-sm text-stone-600">
          Free slots for the next 14 days, Adelaide time. Default job length is 3
          hours. Recommended times sit near other jobs the same day.
        </p>
      </div>
      <BookingPicker job={job} slots={slots} eventTitle={jobEventTitle(job)} />
    </div>
  );
}
