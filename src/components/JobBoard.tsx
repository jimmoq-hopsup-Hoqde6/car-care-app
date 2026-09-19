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
import { AutomationBadges } from "./AutomationBadges";
import { StatusBadge } from "./StatusBadge";

type ActivitySort = "newest" | "stalled";

type JobWithPhotos = Job & { photos: Photo[] };

export function JobBoard({
  jobs,
  settings,
}: {
  jobs: JobWithPhotos[];
  settings: AutomationSettings;
}) {
  const [filter, setFilter] = useState<JobStatusValue | "ALL">("ALL");
  const [sort, setSort] = useState<ActivitySort>("newest");

  const byActivity = useMemo(() => {
    const ranked = [...jobs].sort((a, b) => {
      const diff =
        activityMillis(b.lastActivityAt, b.updatedAt) -
        activityMillis(a.lastActivityAt, a.updatedAt);
      return sort === "newest" ? diff : -diff;
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
        <Link
          href="/jobs/new"
          className="inline-flex items-center justify-center rounded-full bg-teal px-4 py-2.5 text-sm font-semibold text-ink shadow-sm hover:brightness-95"
        >
          New job
        </Link>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden">
        <FilterChip
          active={filter === "ALL"}
          onClick={() => setFilter("ALL")}
          label={`All (${jobs.length})`}
        />
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
            Nothing in this column yet.
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
      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
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
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
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
  const photo = job.photos[0];
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block rounded-2xl border border-line bg-card p-3 shadow-sm hover:border-teal/40"
    >
      <div className="flex gap-3">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.url}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 rounded-xl bg-stone-200 object-cover ring-1 ring-line"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-stone-100 text-[10px] text-stone-400">
            No photo
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-semibold text-ink">{job.customerName}</p>
            <StatusBadge status={job.status} />
          </div>
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
          <AutomationBadges job={job} settings={settings} />
        </div>
      </div>
    </Link>
  );
}
