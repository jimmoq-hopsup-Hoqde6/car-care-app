import { DEFAULT_GOOGLE_REVIEW_URL, formatOwnerMobile } from "./constants";
import { emailGreeting } from "./quote";

export function signOff(includeMobile = false) {
  return `Kind regards,
Marcel Kuhn
Mobile Car Scratch Repair Adelaide${includeMobile ? `\n${formatOwnerMobile()}` : ""}`;
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

export function buildPhotoAskEmail(input: {
  customerName?: string | null;
  suburb?: string | null;
  service?: string | null;
  notes?: string | null;
}) {
  const suburb = input.suburb?.trim();
  const service = (input.service?.trim() || "the repair").replace(/^the\s+/i, "");
  const about = suburb
    ? `the ${service} in ${suburb}`
    : `the ${service}`;
  const coating = /ceramic coating/i.test(input.notes ?? "")
    ? " If ceramic coating is on the car, a couple of angles in good light are ideal."
    : "";

  return `${emailGreeting(input.customerName)}

Thanks for getting in touch about ${about}.

To give you an accurate quote, could you please reply with a few clear photos of the damage (close-ups and a wider shot of the panel/bonnet help a lot)?${coating}

Once I have the pictures I’ll send through a quote.

${signOff(true)}`;
}

export function photoAskSubject(suburb?: string | null) {
  return suburb
    ? `Photos for your quote — ${suburb}`
    : "Photos for your quote";
}

export function buildScopeDeclineEmail(customerName?: string | null) {
  return `${emailGreeting(customerName)}

Thanks for getting in touch.

With our mobile service, the only panels we are unable to repair are the horizontal ones — the bonnet and the roof.

If the damage is on another panel — a door, bumper, guard, quarter, tailgate or spoiler — reply with a few photos and I’ll gladly quote it.

${signOff(true)}`;
}

export function scopeDeclineSubject() {
  return "About your repair enquiry";
}
