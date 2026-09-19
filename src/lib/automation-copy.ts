import { DEFAULT_GOOGLE_REVIEW_URL } from "./constants";
import { emailGreeting } from "./quote";

export function signOff() {
  return `Kind regards,
Marcel Kuhn
Mobile Car Scratch Repair Adelaide`;
}

export function buildFollowUpEmail(customerName: string) {
  return `${emailGreeting(customerName)}

Just checking in on the quote I sent through. Happy to lock in a day if you'd like to go ahead, or answer any questions.

${signOff()}`;
}

export function followUpSubject(vehicle?: string | null) {
  return vehicle
    ? `Just checking in — ${vehicle}`
    : "Just checking in on your quote";
}

export function buildReviewAskEmail(
  customerName: string,
  reviewUrl: string = DEFAULT_GOOGLE_REVIEW_URL,
) {
  const link = reviewUrl.trim() || DEFAULT_GOOGLE_REVIEW_URL;
  return `${emailGreeting(customerName)}

Thanks for having me out — hope the repair is looking good.

If you have a minute, a Google review helps other Adelaide drivers find the service:

${link}

${signOff()}`;
}

export function reviewAskSubject() {
  return "Thanks again — a quick Google review?";
}
