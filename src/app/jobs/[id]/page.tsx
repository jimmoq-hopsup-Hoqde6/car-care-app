import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusSelect } from "@/components/StatusSelect";
import { CHANNEL_LABELS } from "@/lib/constants";
import { formatAdelaide } from "@/lib/booking";
import { formatAUD } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { parseRepairItems } from "@/lib/quote";

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: { photos: true, drafts: { orderBy: { createdAt: "desc" } } },
  });
  if (!job) notFound();

  const items = parseRepairItems(job.repairItems);

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm text-teal">
        ← Job board
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-ink">{job.customerName}</h1>
            <StatusBadge status={job.status} />
          </div>
          <p className="mt-1 text-stone-600">
            {job.vehicle || "Vehicle not set"} · {job.suburb || "Suburb not set"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/jobs/${job.id}/quote`}
            className="rounded-full bg-teal px-4 py-2.5 text-sm font-semibold text-white"
          >
            Quote
          </Link>
          <Link
            href={`/jobs/${job.id}/book`}
            className="rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink"
          >
            Book
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-sm font-semibold text-ink">Details</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Email" value={job.customerEmail} />
            <Row label="Phone" value={job.customerPhone} />
            <Row label="Address" value={job.address} />
            <Row label="Channel" value={CHANNEL_LABELS[job.channel] ?? job.channel} />
            <Row
              label="Quote"
              value={
                job.quoteAmount != null
                  ? formatAUD(job.quoteAmount)
                  : "Not entered yet"
              }
            />
            <Row
              label="Booked"
              value={
                job.bookedStart && job.bookedEnd
                  ? `${formatAdelaide(job.bookedStart)} – ${formatAdelaide(job.bookedEnd, "h:mm a")}`
                  : "Not booked"
              }
            />
          </dl>
          <p className="mt-4 text-sm text-stone-600">{job.damageNotes}</p>
          {items.length > 0 ? (
            <ul className="mt-3 list-disc pl-5 text-sm text-stone-700">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-sm font-semibold text-ink">Move status</h2>
          <div className="mt-2">
            <StatusSelect jobId={job.id} status={job.status} />
          </div>
          {job.photos.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {job.photos.map((photo) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={photo.id}
                  src={photo.url}
                  alt={photo.filename ?? "Damage photo"}
                  width={320}
                  height={144}
                  className="h-36 w-full rounded-xl bg-stone-200 object-cover ring-1 ring-line"
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-stone-500">No photos on this job yet.</p>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="text-sm font-semibold text-ink">Drafts</h2>
        {job.drafts.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">
            No quote or confirmation drafts yet.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {job.drafts.map((draft) => (
              <article
                key={draft.id}
                className="rounded-xl border border-line bg-white p-3"
              >
                <p className="text-xs uppercase tracking-wide text-stone-500">
                  {draft.type}
                  {draft.sentAt ? " · sent" : " · draft"}
                  {draft.gmailDraftId ? " · in Gmail" : ""}
                </p>
                <p className="font-medium text-ink">{draft.subject}</p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-stone-700">
                  {draft.body}
                </pre>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right text-ink">{value || "—"}</dd>
    </div>
  );
}
