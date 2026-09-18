"use client";

import { JobStatus } from "@prisma/client";
import { updateJobStatus } from "@/app/actions/jobs";
import { JOB_STATUSES, STATUS_LABELS } from "@/lib/constants";

export function StatusSelect({
  jobId,
  status,
}: {
  jobId: string;
  status: JobStatus;
}) {
  return (
    <select
      defaultValue={status}
      onChange={(event) => {
        void updateJobStatus(jobId, event.target.value as JobStatus);
      }}
      className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
    >
      {JOB_STATUSES.map((value) => (
        <option key={value} value={value}>
          {STATUS_LABELS[value]}
        </option>
      ))}
    </select>
  );
}
