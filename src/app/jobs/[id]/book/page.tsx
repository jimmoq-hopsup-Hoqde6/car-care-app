import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingPicker } from "@/components/BookingPicker";
import { jobEventTitle, listAvailableSlots } from "@/lib/booking";
import { prisma } from "@/lib/prisma";

export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) notFound();
  const slots = await listAvailableSlots(14);

  return (
    <div className="space-y-5">
      <Link href={`/jobs/${job.id}`} className="text-sm text-teal">
        ← {job.customerName}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-ink">Pick a booking</h1>
        <p className="text-sm text-stone-600">
          Free slots for the next 14 days, Adelaide time. Default job length is 3
          hours.
        </p>
      </div>
      <BookingPicker job={job} slots={slots} eventTitle={jobEventTitle(job)} />
    </div>
  );
}
