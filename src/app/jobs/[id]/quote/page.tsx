import Link from "next/link";
import { notFound } from "next/navigation";
import { PhotoGallery } from "@/components/PhotoGallery";
import { QuoteComposer } from "@/components/QuoteComposer";
import { prisma } from "@/lib/prisma";
import { parseRepairItems } from "@/lib/quote";

export default async function QuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [job, priceBands] = await Promise.all([
    prisma.job.findUnique({ where: { id }, include: { photos: true } }),
    prisma.priceBand.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  if (!job) notFound();

  return (
    <div className="space-y-5">
      <Link href={`/jobs/${job.id}`} className="text-sm font-medium text-teal-dark">
        ← {job.customerName}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-ink">Quote composer</h1>
        <p className="text-sm text-stone-600">
          You enter the price. The email follows your locked standard wording.
        </p>
        {job.outOfScope ? (
          <p className="mt-2 rounded-xl bg-amber-100 px-3 py-2 text-sm font-medium text-amber-950">
            Out of scope — bonnet and roof are the only panels this mobile
            service cannot repair. Use the decline draft instead of quoting.
          </p>
        ) : null}
      </div>
      <PhotoGallery jobId={job.id} photos={job.photos} compact />
      <QuoteComposer
        job={job}
        priceBands={priceBands}
        items={parseRepairItems(job.repairItems)}
      />
    </div>
  );
}
