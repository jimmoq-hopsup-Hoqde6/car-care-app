"use client";

import { dismissJob } from "@/app/actions/jobs";

export function DismissJobButton({
  jobId,
  customerName,
}: {
  jobId: string;
  customerName: string;
}) {
  return (
    <form
      action={dismissJob.bind(null, jobId)}
      onSubmit={(event) => {
        if (
          !confirm(
            `Remove ${customerName} from the job board? Photos and drafts on this card go with it.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="desk-btn min-h-11 w-full border border-line bg-white text-sm text-ink"
      >
        Remove from board
      </button>
    </form>
  );
}
