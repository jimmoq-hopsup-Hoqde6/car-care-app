import type { Job } from "@prisma/client";
import {
  skipFollowUpAction,
  skipReviewAskAction,
} from "@/app/actions/automations";
import {
  followUpClockStart,
  followUpPhase,
  PHASE_LABELS,
  reviewAskPhase,
  type AutomationSettings,
} from "@/lib/automation-status";
import { formatAdelaide } from "@/lib/booking";
import { isDemoMode } from "@/lib/env";

function when(value?: Date | null) {
  return value ? formatAdelaide(value, "d MMM, h:mm a") : null;
}

export function AutomationPanel({
  job,
  settings,
}: {
  job: Job;
  settings: AutomationSettings;
}) {
  const follow = followUpPhase(job, settings);
  const review = reviewAskPhase(job, settings);
  const clock = followUpClockStart(job);
  const demo = isDemoMode();

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h2 className="text-sm font-semibold text-ink">Automations</h2>
      <p className="mt-1 text-xs text-stone-500">
        Quotes and booking confirmations never send on their own. A stalled
        follow-up, review ask, or missing-photo request can. Bonnet/roof
        declines stay as drafts unless auto-decline is on.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <article className="rounded-xl border border-line bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">
            Photo ask
          </p>
          <p className="mt-1 font-semibold text-ink">
            {job.outOfScope
              ? "Not needed"
              : job.photoAskSentAt
                ? "Sent"
                : "Waiting"}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {job.outOfScope
              ? "Not sent — bonnet and roof jobs are out of scope."
              : job.photoAskSentAt
                ? demo
                  ? `Queued ${when(job.photoAskSentAt)} — demo mode, not emailed.`
                  : `Asked for photos ${when(job.photoAskSentAt)}.`
                : "Sends once if an in-scope quote request has no usable repair photos."}
          </p>
        </article>
        <article className="rounded-xl border border-line bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">
            Out of scope
          </p>
          <p className="mt-1 font-semibold text-ink">
            {job.outOfScope
              ? job.declinedAt
                ? "Decline drafted"
                : "Flagged"
              : "In scope"}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {job.outOfScope
              ? "Bonnet and roof are the only panels this mobile service cannot repair. Tailgates and spoilers are in scope."
              : "Doors, bumpers, guards, quarters, tailgates and spoilers are in scope."}
          </p>
        </article>
        <article className="rounded-xl border border-line bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">
            Follow-up
          </p>
          <p className="mt-1 font-semibold text-ink">{PHASE_LABELS[follow]}</p>
          <p className="mt-1 text-xs text-stone-500">
            {follow === "pending"
              ? `Due — no reply for ${settings.followUpDays} days.`
              : follow === "waiting"
                ? `Sends ${settings.followUpDays} days after the quote if they have not replied.`
                : follow === "sent"
                  ? demo
                    ? `Queued ${when(job.followUpSentAt)} — demo mode, not emailed.`
                    : `Sent ${when(job.followUpSentAt)}.`
                  : follow === "skipped"
                    ? "You skipped this follow-up."
                    : "Only applies while awaiting the customer."}
          </p>
          {clock && follow === "waiting" ? (
            <p className="mt-1 text-xs text-stone-400">
              Clock started {when(clock)}.
            </p>
          ) : null}
          {follow === "pending" || follow === "waiting" ? (
            <form action={skipFollowUpAction.bind(null, job.id)} className="mt-2">
              <button
                type="submit"
                className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold"
              >
                Skip follow-up
              </button>
            </form>
          ) : null}
        </article>

        <article className="rounded-xl border border-line bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">
            Google review ask
          </p>
          <p className="mt-1 font-semibold text-ink">{PHASE_LABELS[review]}</p>
          <p className="mt-1 text-xs text-stone-500">
            {review === "pending"
              ? `Due — job marked done ${settings.reviewAskDaysAfterJob === 1 ? "yesterday or earlier" : `${settings.reviewAskDaysAfterJob} days ago`}.`
              : review === "waiting"
                ? `Sends ${settings.reviewAskDaysAfterJob} day${settings.reviewAskDaysAfterJob === 1 ? "" : "s"} after you mark the job Done.`
                : review === "sent"
                  ? demo
                    ? `Queued ${when(job.reviewAskSentAt)} — demo mode, not emailed.`
                    : `Sent ${when(job.reviewAskSentAt)}.`
                  : review === "skipped"
                    ? "You skipped the review ask."
                    : "Marks as pending the day after you move Booked → Done."}
          </p>
          {review === "pending" || review === "waiting" ? (
            <form action={skipReviewAskAction.bind(null, job.id)} className="mt-2">
              <button
                type="submit"
                className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold"
              >
                Skip review ask
              </button>
            </form>
          ) : null}
        </article>
      </div>
    </section>
  );
}
