import type { JobStatus } from "@prisma/client";

export type JobNextAction = {
  sentence: string;
  href: string;
  cta: string;
  tone: "go" | "wait" | "warn";
};

type JobLike = {
  id: string;
  status: JobStatus | string;
  quoteAmount?: number | null;
  outOfScope?: boolean | null;
  photoAskSentAt?: Date | null;
  bookedStart?: Date | null;
  photos?: { id: string }[];
  drafts?: { type: string; sentAt: Date | null }[];
};

/**
 * One-sentence next step for Marcel on a job (phone path).
 * Quotes and booking confirmations still never auto-send.
 */
export function nextActionForJob(job: JobLike): JobNextAction {
  const quoteHref = `/jobs/${job.id}/quote`;
  const bookHref = `/jobs/${job.id}/book`;
  const photos = job.photos?.length ?? 0;
  const quoteDraft = job.drafts?.find((item) => item.type === "quote");
  const confirmDraft = job.drafts?.find((item) => item.type === "confirmation");

  if (job.outOfScope) {
    return {
      sentence:
        "Bonnet or roof — do not quote. Review the decline draft, then Send if you want it to go.",
      href: quoteHref,
      cta: "Open decline",
      tone: "warn",
    };
  }

  if (job.status === "NEEDS_QUOTE") {
    if (photos === 0 && job.photoAskSentAt) {
      return {
        sentence:
          "Waiting on repair photos. Open Quote when they arrive, or type a price if you already have enough.",
        href: quoteHref,
        cta: "Open quote",
        tone: "wait",
      };
    }
    if (job.quoteAmount == null) {
      return {
        sentence:
          "Open Quote, tap Accept suggestion or enter the price, then Save draft or Send — nothing emails itself.",
        href: quoteHref,
        cta: "Write quote",
        tone: "go",
      };
    }
    return {
      sentence:
        "Price is in. Save the Gmail draft or Send, then wait for the customer.",
      href: quoteHref,
      cta: "Finish quote",
      tone: "go",
    };
  }

  if (job.status === "AWAITING_CUSTOMER") {
    return {
      sentence:
        "Quote is with the customer. A follow-up may send on its own — do not send another quote unless they reply.",
      href: `/jobs/${job.id}`,
      cta: "Stay on job",
      tone: "wait",
    };
  }

  if (job.status === "READY_TO_BOOK") {
    return {
      sentence:
        "They are waiting for your booking approval. Pick a suburb-aware slot, then save the confirmation draft (it will not send itself).",
      href: bookHref,
      cta: "Pick a slot",
      tone: "go",
    };
  }

  if (job.status === "BOOKED") {
    if (confirmDraft && !confirmDraft.sentAt) {
      return {
        sentence:
          "In the calendar. Send the confirmation draft when you are ready — it has not gone to the customer yet.",
        href: `/jobs/${job.id}`,
        cta: "See draft",
        tone: "wait",
      };
    }
    return {
      sentence:
        "Booked in Adelaide time. Mark Done when the repair is finished.",
      href: `/jobs/${job.id}`,
      cta: "Stay on job",
      tone: "wait",
    };
  }

  if (quoteDraft && job.status === "DONE") {
    return {
      sentence:
        "Repair finished. A Google review ask may send the next day. Nothing else auto-sends.",
      href: `/jobs/${job.id}`,
      cta: "Stay on job",
      tone: "wait",
    };
  }

  return {
    sentence:
      "Repair finished. A Google review ask may send the next day.",
    href: `/jobs/${job.id}`,
    cta: "Stay on job",
    tone: "wait",
  };
}
