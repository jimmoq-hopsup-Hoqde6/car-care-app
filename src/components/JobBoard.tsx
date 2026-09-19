"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Job, Photo } from "@prisma/client";
import {
  JOB_STATUSES,
  STATUS_HELP,
  STATUS_LABELS,
  type JobStatusValue,
} from "@/lib/constants";
import type { AutomationSettings } from "@/lib/automation-status";
import {
  activityMillis,
  formatBookedSlot,
  formatLastActivity,
} from "@/lib/activity";
import {
  bookingNextCta,
  forgottenReadyToBook,
  isReadyToBookNoDate,
  isStalledAwaiting,
  waitingSinceLabel,
} from "@/lib/booking-ops";
import { nextActionForJob } from "@/lib/job-next";
import { formatAUD } from "@/lib/money";
import { formatAuMobile } from "@/lib/phone";
import { primaryPhoto } from "@/lib/photos";
import { STATUS_COLUMN_DOT, STATUS_EDGE } from "@/lib/status-style";
import { AutomationBadges } from "./AutomationBadges";
import { PhotoFrame } from "./PhotoFrame";
import { StatusBadge } from "./StatusBadge";
import { SyncInboxButton } from "./SyncInboxButton";

type ActivitySort = "newest" | "stalled" | "needs-reply" | "value";
type BoardFilter = JobStatusValue | "ALL" | "NEEDS_REPLY";

type JobWithPhotos = Job & {
  photos: Photo[];
  _count?: { smsMessages: number };
};

export function JobBoard({
  jobs,
  settings,
  demo = false,
  googleConnected = false,
  unreadApprovals = 0,
  inboxError,
  imported = 0,
}: {
  jobs: JobWithPhotos[];
  settings: AutomationSettings;
  demo?: boolean;
  googleConnected?: boolean;
  unreadApprovals?: number;
  inboxError?: string;
  imported?: number;
}) {
  const forgotten = useMemo(() => forgottenReadyToBook(jobs), [jobs]);
  const [filter, setFilter] = useState<BoardFilter>("ALL");
  const [sort, setSort] = useState<ActivitySort>(
    forgotten.length > 0 ? "needs-reply" : "newest",
  );

  const byActivity = useMemo(() => {
    const ranked = [...jobs].sort((a, b) => {
      if (sort === "needs-reply") {
        const aForgot = isReadyToBookNoDate(a) ? 0 : 1;
        const bForgot = isReadyToBookNoDate(b) ? 0 : 1;
        if (aForgot !== bForgot) return aForgot - bForgot;
        if (aForgot === 0) {
          const aTime =
            activityMillis(a.lastCustomerReplyAt, a.lastActivityAt) ||
            activityMillis(a.updatedAt);
          const bTime =
            activityMillis(b.lastCustomerReplyAt, b.lastActivityAt) ||
            activityMillis(b.updatedAt);
          return aTime - bTime;
        }
      }
      if (sort === "value") {
        return (b.quoteAmount ?? -1) - (a.quoteAmount ?? -1);
      }
      const diff =
        activityMillis(b.lastActivityAt, b.updatedAt) -
        activityMillis(a.lastActivityAt, a.updatedAt);
      return sort === "stalled" ? -diff : diff;
    });
    return ranked;
  }, [jobs, sort]);

  const grouped = useMemo(() => {
    return JOB_STATUSES.map((status) => {
      const columnJobs = byActivity.filter((job) => job.status === status);
      const quoted = columnJobs.reduce(
        (sum, job) => sum + (job.quoteAmount ?? 0),
        0,
      );
      return { status, jobs: columnJobs, quoted };
    });
  }, [byActivity]);

  const visible =
    filter === "ALL"
      ? byActivity
      : filter === "NEEDS_REPLY"
        ? byActivity.filter((job) => isReadyToBookNoDate(job))
        : byActivity.filter((job) => job.status === filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Job board
          </h1>
          <p className="mt-1 text-sm text-muted">
            Quote, wait, book, done — Marcel types every price.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SortChip
              active={sort === "needs-reply"}
              onClick={() => setSort("needs-reply")}
              label="Needs your reply"
            />
            <SortChip
              active={sort === "newest"}
              onClick={() => setSort("newest")}
              label="Newest activity"
            />
            <SortChip
              active={sort === "stalled"}
              onClick={() => setSort("stalled")}
              label="Stalled first"
            />
            <SortChip
              active={sort === "value"}
              onClick={() => setSort("value")}
              label="Highest quote"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Link
            href="/jobs/new"
            className="desk-btn bg-teal text-ink shadow-sm hover:brightness-95"
          >
            New job
          </Link>
          {jobs.length > 0 ? (
            <SyncInboxButton className="desk-btn border border-line bg-white text-ink disabled:opacity-60" />
          ) : null}
        </div>
      </div>

      {inboxError ? (
        <div
          role="alert"
          className="desk-card border-amber-200 bg-amber-50 px-4 py-3 text-sm text-ink"
        >
          <p className="font-semibold">Inbox could not load Gmail</p>
          <p className="mt-1 text-muted">{inboxError}</p>
          <Link
            href="/settings"
            className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-teal-dark underline"
          >
            Open Settings to reconnect Google
          </Link>
        </div>
      ) : null}

      {imported > 0 ? (
        <p className="desk-card border-teal/30 bg-teal/10 px-4 py-2.5 text-sm text-ink">
          Added {imported} {imported === 1 ? "thread" : "threads"} to the job
          board.
        </p>
      ) : null}

      {forgotten.length > 0 ? (
        <div className="desk-card border-amber-200 bg-amber-50 px-4 py-3 text-sm text-ink">
          <p className="font-semibold">
            Needs your reply — {forgotten.length} ready to book, no date
          </p>
          <p className="mt-1 text-xs text-muted">
            They accepted or asked to book. Quotes and booking confirms still
            never auto-send.
          </p>
          <ul className="mt-2 space-y-1.5">
            {forgotten.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}/book`}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 font-semibold shadow-sm"
                >
                  <span className="min-w-0 truncate">
                    {job.customerName}
                    {job.suburb ? ` · ${job.suburb}` : ""} ·{" "}
                    {waitingSinceLabel(job)}
                  </span>
                  <span className="shrink-0 text-teal-dark">
                    {bookingNextCta(job)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/notifications"
            className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-teal-dark underline"
          >
            Open alerts
          </Link>
        </div>
      ) : unreadApprovals > 0 ? (
        <Link
          href="/notifications"
          className="desk-card flex min-h-11 flex-col gap-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-ink sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            {unreadApprovals} waiting for your booking approval
            {unreadApprovals === 1 ? "" : "s"} — pick a slot, nothing auto-sends.
          </span>
          <span className="shrink-0 text-teal-dark">Open alerts</span>
        </Link>
      ) : null}

      {jobs.length === 0 ? (
        <div className="desk-card border-dashed px-5 py-10 text-center sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Empty board
          </p>
          <h2 className="mt-2 text-lg font-semibold text-ink">
            No jobs on the board yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {demo
              ? "Sample jobs usually load in demo. Use Inbox or New job to add work."
              : googleConnected
                ? "Sign-in worked. Sync Inbox to pull eligible Gmail threads onto this board — marketing such as Manheim stays ignored."
                : "Connect Google, then tap Sync inbox now so this hosted board is not stuck on All (0). New Quote Request forms and ready-to-book replies will appear here."}
          </p>
          <div className="mt-5 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SyncInboxButton />
            <Link
              href="/inbox"
              className="desk-btn border border-line bg-white text-ink"
            >
              Open Inbox
            </Link>
            <Link
              href="/settings"
              className="desk-btn border border-line bg-white text-ink"
            >
              Settings
            </Link>
          </div>
        </div>
      ) : null}

      {jobs.length > 0 ? (
        <>
          <div
            className={`sticky z-10 -mx-4 border-b border-line/80 bg-background/95 px-4 py-2 backdrop-blur md:hidden ${
              demo ? "top-20" : "top-14"
            }`}
          >
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              <FilterChip
                active={filter === "ALL"}
                onClick={() => setFilter("ALL")}
                label={`All (${jobs.length})`}
              />
              {forgotten.length > 0 ? (
                <FilterChip
                  active={filter === "NEEDS_REPLY"}
                  onClick={() => setFilter("NEEDS_REPLY")}
                  label={`Needs your reply (${forgotten.length})`}
                />
              ) : null}
              {grouped.map((column) => (
                <FilterChip
                  key={column.status}
                  active={filter === column.status}
                  onClick={() => setFilter(column.status)}
                  label={`${STATUS_LABELS[column.status]} (${column.jobs.length})`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {visible.length === 0 ? (
              <p className="desk-card border-dashed px-5 py-8 text-center text-sm text-muted">
                {filter === "NEEDS_REPLY"
                  ? "No ready-to-book jobs waiting on a date. Sync inbox if a customer just replied."
                  : "Nothing in this column yet."}
              </p>
            ) : (
              visible.map((job) => (
                <JobCard key={job.id} job={job} settings={settings} />
              ))
            )}
          </div>

          <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-5">
            {grouped.map((column) => (
              <section key={column.status} className="min-w-0">
                <header className="mb-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${STATUS_COLUMN_DOT[column.status]}`}
                        aria-hidden
                      />
                      <span className="truncate">
                        {STATUS_LABELS[column.status]}
                      </span>
                    </h2>
                    <span className="shrink-0 text-xs tabular-nums text-muted">
                      {column.jobs.length}
                      {column.quoted > 0
                        ? ` · ${formatAUD(column.quoted)}`
                        : ""}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">
                    {STATUS_HELP[column.status]}
                  </p>
                </header>
                <div className="space-y-2.5">
                  {column.jobs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-line bg-white/60 px-4 py-6 text-center text-xs text-muted">
                      No jobs
                    </div>
                  ) : (
                    column.jobs.map((job) => (
                      <JobCard key={job.id} job={job} settings={settings} />
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function SortChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-full px-3 py-2.5 text-sm font-semibold transition-colors ${
        active ? "bg-teal text-ink" : "bg-white text-ink ring-1 ring-line"
      }`}
    >
      {label}
    </button>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 shrink-0 rounded-full px-3 py-2.5 text-sm font-semibold transition-colors ${
        active ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-line"
      }`}
    >
      {label}
    </button>
  );
}

function JobCard({
  job,
  settings,
}: {
  job: JobWithPhotos;
  settings: AutomationSettings;
}) {
  const photo = primaryPhoto(job.photos);
  const next = nextActionForJob(job);
  const noDate = isReadyToBookNoDate(job);
  const stalled = isStalledAwaiting(job);
  const phone = formatAuMobile(job.customerPhone);
  const booked = formatBookedSlot(job.bookedStart);
  const edge = STATUS_EDGE[job.status as JobStatusValue] ?? "border-l-stone-300";

  return (
    <Link
      href={`/jobs/${job.id}`}
      className={`block overflow-hidden rounded-2xl border border-l-4 bg-card shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-150 hover:border-teal/40 ${edge} ${
        noDate ? "border-amber-300" : "border-line"
      }`}
    >
      <PhotoFrame
        src={photo?.url}
        alt={`${job.customerName} damage photo`}
        className="h-44 w-full md:h-32"
      >
        {job.photos.length > 1 ? (
          <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
            {job.photos.length} photos
          </span>
        ) : null}
        {job.outOfScope ? (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-ink">
            Out of scope
          </span>
        ) : null}
        {job.channel === "sms" || (job._count?.smsMessages ?? 0) > 0 ? (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-white">
            SMS
          </span>
        ) : null}
      </PhotoFrame>
      <div className="p-3.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-ink">
            {job.customerName}
          </p>
          <div className="shrink-0">
            <StatusBadge status={job.status} />
          </div>
        </div>
        <p className="mt-0.5 truncate text-sm text-muted">
          {job.suburb || "Suburb not set"}
          {phone ? ` · ${phone}` : ""}
        </p>
        {job.vehicle ? (
          <p className="truncate text-xs text-stone-500">{job.vehicle}</p>
        ) : null}
        {job.quoteAmount != null ? (
          <p className="mt-1 text-[15px] font-semibold tabular-nums text-ink">
            {formatAUD(job.quoteAmount)}
          </p>
        ) : null}
        {booked && job.status === "BOOKED" ? (
          <p className="mt-1 text-xs font-semibold text-indigo-800">
            {booked}
          </p>
        ) : null}
        {noDate ? (
          <p className="mt-1.5 flex flex-wrap gap-1">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-950">
              Ready to book — no date
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-950">
              {waitingSinceLabel(job)}
            </span>
          </p>
        ) : null}
        {stalled ? (
          <p className="mt-1.5">
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-700 ring-1 ring-stone-200">
              Stalled
            </span>
          </p>
        ) : null}
        <p className="mt-1 truncate text-xs text-stone-500">
          Last:{" "}
          {formatLastActivity(job.lastActivityAt ?? job.updatedAt, new Date(), {
            compact: true,
          })}
        </p>
        <p className="mt-1.5 text-sm font-semibold text-teal-dark">{next.cta}</p>
        <AutomationBadges job={job} settings={settings} />
      </div>
    </Link>
  );
}
