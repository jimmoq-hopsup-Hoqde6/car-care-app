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
  let job;
  let priceBands;
  try {
    [job, priceBands] = await Promise.all([
      prisma.job.findUnique({ where: { id }, include: { photos: true } }),
      prisma.priceBand.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);
  } catch {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-xl font-semibold text-ink">Quote could not load</h1>
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

  return (
    <div className="space-y-5">
      <Link href={`/jobs/${job.id}`} className="text-sm font-medium text-teal-dark">
        ← {job.customerName}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Quote composer</h1>
        <p className="mt-1 text-sm text-muted">
          Phone path: Accept suggestion or type the price → Save draft or Send.
          The email follows your locked standard wording and never sends on its
          own.
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
        priceBands={priceBands ?? []}
        items={parseRepairItems(job.repairItems)}
      />
    </div>
  );
}
