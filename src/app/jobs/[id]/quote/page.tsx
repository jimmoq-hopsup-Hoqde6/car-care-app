import Link from "next/link";
import { notFound } from "next/navigation";
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
      <Link href={`/jobs/${job.id}`} className="text-sm text-teal">
        ← {job.customerName}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-ink">Quote composer</h1>
        <p className="text-sm text-stone-600">
          You enter the price. The email follows your usual wording.
        </p>
      </div>
      <QuoteComposer
        job={job}
        priceBands={priceBands}
        items={parseRepairItems(job.repairItems)}
      />
    </div>
  );
}
