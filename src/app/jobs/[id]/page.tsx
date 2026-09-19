import Link from "next/link";
import { notFound } from "next/navigation";
import { AutomationPanel } from "@/components/AutomationPanel";
import { PhotoGallery } from "@/components/PhotoGallery";
import { SmsThread } from "@/components/SmsThread";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusSelect } from "@/components/StatusSelect";
import { formatLastActivity } from "@/lib/activity";
import { formatAdelaide } from "@/lib/booking";
import { isReadyToBookNoDate } from "@/lib/booking-ops";
import { CHANNEL_LABELS } from "@/lib/constants";
import { nextActionForJob } from "@/lib/job-next";
import { formatAUD } from "@/lib/money";
import { formatAuMobile, toE164Au } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { parseRepairItems } from "@/lib/quote";
import { getSettings } from "@/lib/settings";

function mapsHref(suburb?: string | null, address?: string | null) {
  const q = [address, suburb, "Adelaide"].filter(Boolean).join(", ");
  return `https://maps.google.com/?q=${encodeURIComponent(q)}`;
}

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let job;
  let settings;
  try {
    [job, settings] = await Promise.all([
      prisma.job.findUnique({
        where: { id },
        include: {
          photos: true,
          drafts: { orderBy: { createdAt: "desc" } },
          smsMessages: { orderBy: { createdAt: "asc" } },
        },
      }),
      getSettings(),
    ]);
  } catch {
    return (
      <div className="desk-card border-amber-200 bg-amber-50 p-6">
        <h1 className="text-xl font-semibold text-ink">Job could not load</h1>
        <p className="mt-2 text-sm text-muted">
          The database may be unreachable. Try the job board again in a moment.
        </p>
        <Link href="/" className="desk-btn mt-4 bg-teal text-ink">
          Job board
        </Link>
      </div>
    );
  }
  if (!job) notFound();

  const items = parseRepairItems(job.repairItems);
  const next = nextActionForJob(job);
  const quoteHref = `/jobs/${job.id}/quote`;
  const bookHref = `/jobs/${job.id}/book`;
  const noDate = isReadyToBookNoDate(job);
  const phoneDisplay = formatAuMobile(job.customerPhone);
  const phoneTel = toE164Au(job.customerPhoneE164 || job.customerPhone);
  const canMap = Boolean(job.address || job.suburb);

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm font-medium text-teal-dark">
        ← Job board
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {job.customerName}
            </h1>
            <StatusBadge status={job.status} />
            {job.photoAskSentAt && job.photos.length === 0 && !job.outOfScope ? (
              <span className="rounded-full bg-teal/15 px-3 py-1 text-xs font-semibold text-teal-dark">
                Awaiting photos
              </span>
            ) : null}
            {noDate ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950">
                Ready to book — no date
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-muted">
            {job.vehicle || "Vehicle not set"} · {job.suburb || "Suburb not set"}
          </p>
          <p className="mt-1 text-sm font-medium text-ink">
            Last activity ·{" "}
            {formatLastActivity(job.lastActivityAt ?? job.updatedAt)}
          </p>
          <p className="text-xs text-stone-500">Australia/Adelaide</p>
          {job.outOfScope ? (
            <p className="mt-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950">
              Out of scope — bonnet or roof
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {next.href !== quoteHref ? (
            <Link
              href={quoteHref}
              className="desk-btn min-h-12 border border-line bg-white px-5 text-ink"
            >
              Quote
            </Link>
          ) : (
            <Link
              href={bookHref}
              className="desk-btn min-h-12 border border-line bg-white px-5 text-ink"
            >
              Book
            </Link>
          )}
        </div>
      </div>

      <div
        className={`desk-card overflow-hidden border-l-4 px-4 py-4 ${
          next.tone === "warn"
            ? "border-amber-200 border-l-amber-400 bg-amber-50"
            : next.tone === "wait"
              ? "border-l-stone-300"
              : "border-teal/30 border-l-teal bg-teal/10"
        }`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Next
        </p>
        <p className="mt-1.5 text-base font-semibold leading-snug text-ink">
          {next.sentence}
        </p>
        <p className="mt-1.5 text-xs text-muted">
          Quotes and booking confirmations never send unless you tap Send.
        </p>
        <Link
          href={next.href}
          className="desk-btn mt-4 min-h-12 w-full bg-teal text-base text-ink shadow-sm hover:brightness-95"
        >
          {next.cta}
        </Link>
      </div>

      {phoneTel || canMap ? (
        <div
          className={`grid gap-2 ${phoneTel && canMap ? "grid-cols-2" : "grid-cols-1"}`}
        >
          {phoneTel ? (
            <a
              href={`tel:${phoneTel}`}
              className="desk-btn min-h-12 border border-line bg-white text-ink"
            >
              Call {phoneDisplay || phoneTel}
            </a>
          ) : null}
          {canMap ? (
            <a
              href={mapsHref(job.suburb, job.address)}
              className="desk-btn min-h-12 border border-line bg-white text-ink"
              target="_blank"
              rel="noreferrer"
            >
              Maps
            </a>
          ) : null}
        </div>
      ) : null}

      {job.bookedStart && job.bookedEnd ? (
        <section className="desk-card border-l-4 border-l-indigo-400 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Booked
          </p>
          <p className="mt-1 text-lg font-semibold text-ink">
            {formatAdelaide(job.bookedStart)} –{" "}
            {formatAdelaide(job.bookedEnd, "h:mm a")}
          </p>
          <p className="mt-1 text-sm text-muted">
            {job.address || job.suburb || "Add an address on the job"}
          </p>
        </section>
      ) : noDate ? (
        <section className="desk-card border-l-4 border-l-teal border-amber-200 bg-amber-50 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-900">
            Ready to book — no date
          </p>
          <p className="mt-1 text-sm text-ink">
            No calendar event yet. Use the next action above — the confirmation
            draft will not send itself.
          </p>
        </section>
      ) : null}

      <PhotoGallery jobId={job.id} photos={job.photos} />

      <SmsThread
        jobId={job.id}
        customerPhone={job.customerPhoneE164 || job.customerPhone}
        messages={job.smsMessages}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="desk-card p-4">
          <h2 className="text-sm font-semibold text-ink">Details</h2>
          <dl className="mt-1">
            <Row
              label="Last activity"
              value={formatLastActivity(job.lastActivityAt ?? job.updatedAt)}
            />
            <Row
              label="Email"
              value={job.customerEmail}
              href={
                job.customerEmail ? `mailto:${job.customerEmail}` : undefined
              }
            />
            <Row
              label="Phone"
              value={phoneDisplay || job.customerPhone}
              href={phoneTel ? `tel:${phoneTel}` : undefined}
            />
            <Row
              label="Address"
              value={job.address}
              href={canMap ? mapsHref(job.suburb, job.address) : undefined}
            />
            <Row
              label="Channel"
              value={CHANNEL_LABELS[job.channel] ?? job.channel}
            />
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
          <p className="mt-4 text-sm text-muted">{job.damageNotes}</p>
          {items.length > 0 ? (
            <ul className="mt-3 list-disc pl-5 text-sm text-ink">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="desk-card p-4">
          <h2 className="text-sm font-semibold text-ink">Move status</h2>
          <p className="mt-1 text-xs text-muted">
            Updates the matching Gmail job-desk label. This does not email the
            customer.
          </p>
          <div className="mt-3">
            <StatusSelect jobId={job.id} status={job.status} />
          </div>
        </section>
      </div>

      <AutomationPanel job={job} settings={settings} />

      <section className="desk-card p-4">
        <h2 className="text-sm font-semibold text-ink">Drafts</h2>
        {job.drafts.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No quote or confirmation drafts yet.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {job.drafts.map((draft) => (
              <article
                key={draft.id}
                className="rounded-xl border border-line bg-white p-3"
              >
                <p className="text-xs uppercase tracking-wide text-muted">
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

function Row({
  label,
  value,
  href,
}: {
  label: string;
  value?: string | null;
  href?: string;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/80 py-2.5 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">
        {href && value ? (
          <a
            href={href}
            className="text-teal-dark underline-offset-2 hover:underline"
          >
            {value}
          </a>
        ) : (
          value || "—"
        )}
      </dd>
    </div>
  );
}
