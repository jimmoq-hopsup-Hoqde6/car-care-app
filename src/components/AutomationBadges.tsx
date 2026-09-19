import type { Job } from "@prisma/client";
import {
  followUpPhase,
  PHASE_LABELS,
  reviewAskPhase,
  type AutomationSettings,
} from "@/lib/automation-status";

export function AutomationBadges({
  job,
  settings,
}: {
  job: Job;
  settings: AutomationSettings;
}) {
  const follow = followUpPhase(job, settings);
  const review = reviewAskPhase(job, settings);
  const chips = [
    job.outOfScope
      ? { key: "scope", label: "Out of scope", phase: "pending" }
      : null,
    job.photoAskSentAt && !job.outOfScope
      ? { key: "photos", label: "Awaiting photos", phase: "sent" }
      : null,
    follow !== "n/a" ? { key: "follow", label: `Follow-up ${PHASE_LABELS[follow]}`, phase: follow } : null,
    review !== "n/a" ? { key: "review", label: `Review ${PHASE_LABELS[review]}`, phase: review } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; phase: string }>;

  if (chips.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            chip.phase === "pending"
              ? "bg-amber-100 text-amber-900"
              : chip.phase === "sent"
                ? "bg-teal/15 text-teal-dark"
                : chip.phase === "skipped"
                  ? "bg-stone-200 text-stone-600"
                  : "bg-sky-50 text-sky-800"
          }`}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}
