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
import { activityMillis, formatLastActivity } from "@/lib/activity";
import { formatAUD } from "@/lib/money";
import { primaryPhoto } from "@/lib/photos";
import { nextActionForJob } from "@/lib/job-next";
import {
  bookingNextCta,
  forgottenReadyToBook,
  isReadyToBookNoDate,
  waitingSinceLabel,
} from "@/lib/booking-ops";
import { AutomationBadges } from "./AutomationBadges";
import { StatusBadge } from "./StatusBadge";
import { SyncInboxButton } from "./SyncInboxButton";

type ActivitySort = "newest" | "stalled" | "needs-reply";
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
      const diff =
        activityMillis(b.lastActivityAt, b.updatedAt) -
        activityMillis(a.lastActivityAt, a.updatedAt);
      return sort === "stalled" ? -diff : diff;
    });
    return ranked;
  }, [jobs, sort]);

  const grouped = useMemo(() => {
    return JOB_STATUSES.map((status) => ({
      status,
      jobs: byActivity.filter((job) => job.status === status),
    }));
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
          <p className="mt-1 text-sm text-stone-600">
            Quote, wait, book, done — Marcel types every price.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
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
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Link
            href="/jobs/new"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-teal px-4 py-2.5 text-sm font-semibold text-ink shadow-sm hover:brightness-95"
          >
            New job
          </Link>
          {jobs.length > 0 ? (
            <SyncInboxButton className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-60" />
          ) : null}
        </div>
      </div>

      {inboxError ? (
        <div
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-ink"
        >
          <p className="font-semibold">Inbox could not load Gmail</p>
          <p className="mt-1 text-stone-700">{inboxError}</p>
          <Link
            href="/settings"
            className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-teal-dark underline"
          >
            Open Settings to reconnect Google
          </Link>
        </div>
      ) : null}

      {imported > 0 ? (
        <p className="rounded-2xl border border-teal/40 bg-teal/10 px-4 py-2 text-sm text-ink">
          Added {imported} {imported === 1 ? "thread" : "threads"} to the job
          board.
        </p>
      ) : null}

      {forgotten.length > 0 ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-ink">
          <p className="font-semibold">
            Needs your reply — {forgotten.length} ready to book, no date
          </p>
          <p className="mt-1 text-xs text-stone-700">
            They accepted or asked to book. Quotes and booking confirms still
            never auto-send.
          </p>
          <ul className="mt-2 space-y-1.5">
            {forgotten.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}/book`}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2 font-semibold"
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
          className="flex min-h-11 flex-col gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-ink sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            {unreadApprovals} waiting for your booking approval
            {unreadApprovals === 1 ? "" : "s"} — pick a slot, nothing auto-sends.
          </span>
          <span className="shrink-0 text-teal-dark">Open alerts</span>
        </Link>
      ) : null}

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-6">
          <h2 className="text-lg font-semibold text-ink">No jobs on the board yet</h2>
          <p className="mt-2 text-sm text-stone-600">
            {demo
              ? "Sample jobs usually load in demo. Use Inbox or New job to add work."
              : googleConnected
                ? "Sign-in worked. Sync Inbox to pull eligible Gmail threads onto this board — marketing such as Manheim stays ignored."
                : "Connect Google, then tap Sync inbox now so this hosted board is not stuck on All (0). New Quote Request forms and ready-to-book replies will appear here."}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <SyncInboxButton />
            <Link
              href="/inbox"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink"
            >
              Open Inbox
            </Link>
            <Link
              href="/settings"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink"
            >
              Settings
            </Link>
          </div>
        </div>
      ) : null}

      {jobs.length > 0 ? (
        <>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden">
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

      <div className="space-y-3 md:hidden">
        {visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-card p-6 text-sm text-stone-500">
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
            <header className="mb-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">
                  {STATUS_LABELS[column.status]}
                </h2>
                <span className="text-xs text-stone-500">
                  {column.jobs.length}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-stone-500">
                {STATUS_HELP[column.status]}
              </p>
            </header>
            <div className="space-y-2">
              {column.jobs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-line bg-white/40 p-4 text-xs text-stone-400">
                  Empty
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
      className={`min-h-11 rounded-full px-3 py-2.5 text-sm font-semibold ${
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
      className={`min-h-11 shrink-0 rounded-full px-3 py-2.5 text-sm font-semibold ${
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
  return (
    <Link
      href={`/jobs/${job.id}`}
      className={`block overflow-hidden rounded-2xl border bg-card shadow-sm hover:border-teal/40 ${
        noDate ? "border-amber-300" : "border-line"
      }`}
    >
      <div className="relative bg-stone-200">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.url}
            alt={`${job.customerName} repair photo`}
            width={320}
            height={180}
            className="h-28 w-full object-cover sm:h-24"
          />
        ) : (
          <div className="flex h-28 items-center justify-center text-xs font-medium text-stone-500 sm:h-24">
            No repair photo
          </div>
        )}
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
      </div>
      <div className="p-3">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="min-w-0 truncate font-semibold text-ink">{job.customerName}</p>
          <div className="shrink-0">
            <StatusBadge status={job.status} />
          </div>
        </div>
        {noDate ? (
          <p className="mt-1 flex flex-wrap gap-1">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
              Ready to book — no date
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
              {waitingSinceLabel(job)}
            </span>
          </p>
        ) : null}
        <p className="truncate text-xs text-stone-500">
          Last: {formatLastActivity(job.lastActivityAt ?? job.updatedAt, new Date(), { compact: true })}
        </p>
        <p className="truncate text-sm text-stone-600">
          {job.vehicle || "Vehicle not set"}
        </p>
        <p className="truncate text-xs text-stone-500">
          {job.suburb || "Suburb not set"}
          {job.quoteAmount != null ? ` · ${formatAUD(job.quoteAmount)}` : ""}
        </p>
        <p className="mt-1 text-xs font-medium text-teal-dark">{next.cta}</p>
        <AutomationBadges job={job} settings={settings} />
      </div>
    </Link>
  );
}
