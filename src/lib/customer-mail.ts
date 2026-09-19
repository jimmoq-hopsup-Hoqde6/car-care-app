import { allowedEmails } from "./env";
import { findKnownSuburb } from "./areas";

const BUSINESS_EMAILS = [
  "info@mobilecarscratchrepairadelaide.com.au",
  "moogly88@gmail.com",
];

const NON_CUSTOMER_DOMAINS = [
  "accounts.google.com",
  "smb.sinch.com",
  "sinch.com",
  "sinchengage.com",
  "messagemedia.com",
  "messagemedia.com.au",
  "manheim.com.au",
  "manheim.com",
];

const NON_CUSTOMER_LOCAL = [
  "no-reply",
  "noreply",
  "do-not-reply",
  "donotreply",
  "mailer-daemon",
  "postmaster",
  "compliance",
  "notifications",
  "notification",
  "security",
  "alert",
  "alerts",
  "bounce",
  "bounces",
];

/** From-header tokens that are never a customer, even when the address looks personal. */
const SYSTEM_FROM_MARKERS = [
  /\bsinch(\s+engage)?\b/i,
  /accounts\.google\.com/i,
  /no-?reply@/i,
  /noreply@/i,
  /compliance@/i,
  /mailer-daemon/i,
];

const BLOCKED_GREETING_NAMES = [
  "mobile",
  "info",
  "information",
  "google",
  "accounts",
  "account",
  "noreply",
  "mailer",
  "postmaster",
  "compliance",
  "sinch",
  "messagemedia",
  "support",
  "team",
  "admin",
  "hello",
  "notification",
  "webmaster",
  "automated",
  "system",
  "customer",
  "user",
  "unknown",
];

export function normaliseEmail(value?: string | null) {
  const match = (value ?? "").match(/<([^>]+)>/);
  return (match?.[1] ?? value ?? "").trim().toLowerCase();
}

export function ownBusinessEmails(businessEmail?: string | null) {
  const extras = [
    ...BUSINESS_EMAILS,
    ...allowedEmails(),
    businessEmail ?? "",
  ];
  return [...new Set(extras.map(normaliseEmail).filter(Boolean))];
}

export function isOwnBusinessEmail(
  email?: string | null,
  businessEmail?: string | null,
) {
  const normalised = normaliseEmail(email);
  if (!normalised) return false;
  return ownBusinessEmails(businessEmail).includes(normalised);
}

export function isNonCustomerSender(email?: string | null) {
  const normalised = normaliseEmail(email);
  if (!normalised || !normalised.includes("@")) return true;
  const [local, domain] = normalised.split("@");
  if (!local || !domain) return true;
  if (NON_CUSTOMER_LOCAL.includes(local)) return true;
  if (domain.includes("sinch") || domain.includes("messagemedia")) return true;
  if (NON_CUSTOMER_DOMAINS.some((item) => domain === item || domain.endsWith(`.${item}`))) {
    return true;
  }
  if (domain === "google.com" && /no-?reply|notify|accounts|alert/.test(local)) return true;
  return false;
}

/**
 * Google alerts, Sinch Engage, no-reply, compliance — never a customer thread.
 * Matches the From address and display name ("Aquinnah Mae Salas (Sinch Engage…)").
 */
export function isSystemMailSender(input: {
  from?: string | null;
  fromEmail?: string | null;
}) {
  const hay = `${input.from ?? ""} ${input.fromEmail ?? ""}`.trim();
  if (!hay) return false;
  const fromEmail = normaliseEmail(input.fromEmail || input.from);
  if (fromEmail && isOwnBusinessEmail(fromEmail)) return false;
  if (fromEmail.includes("@") && isNonCustomerSender(fromEmail)) return true;
  const display = (input.from ?? "").replace(/<[^>]+>/g, "").trim();
  if (/^google\b/i.test(display)) return true;
  return SYSTEM_FROM_MARKERS.some((marker) => marker.test(hay));
}

/** Production junk cards: named Google / Sinch, or stored with a system inbox. */
export function isJunkBoardJob(job: {
  customerName?: string | null;
  customerEmail?: string | null;
}) {
  const email = normaliseEmail(job.customerEmail);
  const name = (job.customerName ?? "").trim();
  if (email && (isNonCustomerSender(email) || isOwnBusinessEmail(email))) return true;
  if (/^google$/i.test(name)) return true;
  if (/\bsinch\b/i.test(name) || /\bsinch\b/i.test(email)) return true;
  if (/accounts\.google\.com/i.test(email)) return true;
  return false;
}

/**
 * Real customer inbox only — never Google alerts, Sinch, no-reply, or info@.
 */
export function isCustomerReplyEmail(
  email?: string | null,
  businessEmail?: string | null,
) {
  const normalised = normaliseEmail(email);
  if (!normalised || !normalised.includes("@")) return false;
  if (isOwnBusinessEmail(normalised, businessEmail)) return false;
  if (isNonCustomerSender(normalised)) return false;
  return true;
}

export function customerRecipientOrNull(
  email?: string | null,
  businessEmail?: string | null,
) {
  const normalised = normaliseEmail(email);
  return isCustomerReplyEmail(normalised, businessEmail) ? normalised : null;
}

export function greetingFirstName(fullName?: string | null) {
  const part =
    (fullName ?? "")
      .trim()
      .replace(/<[^>]+>/g, "")
      .split(/\s+/)
      .find((item) => item.length > 0) ?? "";
  if (!part || part.includes("@")) return "";
  const token = part.replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (!token || BLOCKED_GREETING_NAMES.includes(token)) return "";
  return part.replace(/[,:;]+$/g, "");
}

export function extractJobIntakeFields(text?: string | null): {
  suburb?: string;
  vehicle?: string;
  address?: string;
} {
  const hay = text ?? "";
  const vehicleLabel = hay.match(
    /(?:vehicle|car make|\bcar)\s*[:\-]\s*([^\n]+)/i,
  );
  const onA = hay.match(
    /\bon an?\s+([A-Za-z][A-Za-z0-9 .+-]{1,40}?)(?:\s+in\b|[.,]|$)/i,
  );
  const address = hay.match(
    /(?:address|street)\s*(?:is\s+|[:\-]\s*)([^\n.]+)/i,
  );
  const suburbLabel = hay.match(
    /(?:suburb|location|area)\s*[:\-]\s*([A-Za-z][A-Za-z\s'-]{1,40})/i,
  );
  return {
    suburb: findKnownSuburb(hay) || suburbLabel?.[1]?.trim() || undefined,
    vehicle: (vehicleLabel?.[1] || onA?.[1])?.trim() || undefined,
    address: address?.[1]?.trim() || undefined,
  };
}

export function extractCustomerFromBody(text?: string | null): {
  name?: string;
  email?: string;
  phone?: string;
} {
  const haystack = text ?? "";
  const labelledEmail = haystack.match(
    /(?:e-?mail(?:\s*address)?|customer e-?mail|reply-to)\s*[:\-]\s*<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/i,
  );
  const labelledName = haystack.match(
    /(?:customer name|full name|your name|\bname)\s*[:\-]\s*([^\n<]+)/i,
  );
  const labelledPhone = haystack.match(
    /(?:phone|mobile|contact number|tel)\s*[:\-]\s*([+\d][\d\s().-]{7,})/i,
  );
  const emails = [
    labelledEmail?.[1],
    ...(haystack.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []),
  ]
    .map(normaliseEmail)
    .filter((item) => isCustomerReplyEmail(item));

  const email = emails[0];
  const name = labelledName?.[1]?.trim().replace(/["']/g, "");
  const phone = labelledPhone?.[1]?.trim();
  return { name: name || undefined, email, phone: phone || undefined };
}

export function resolveInboxCustomer(input: {
  from: string;
  fromEmail?: string | null;
  replyTo?: string | null;
  subject?: string | null;
  snippet?: string | null;
  businessEmail?: string | null;
}): { name: string; email: string; phone?: string; ignored: boolean } {
  const fromEmail = normaliseEmail(input.fromEmail || input.from);
  const own = isOwnBusinessEmail(fromEmail, input.businessEmail);
  const system = isSystemMailSender({ from: input.from, fromEmail });

  // Google / Sinch / no-reply must never become a customer from a body email.
  if (system && !own) {
    return { name: "Customer", email: "", ignored: true };
  }

  const parsed = extractCustomerFromBody(
    `${input.subject ?? ""}\n${input.snippet ?? ""}`,
  );
  const replyTo = normaliseEmail(input.replyTo);

  const email = own
    ? customerRecipientOrNull(replyTo, input.businessEmail) ||
      customerRecipientOrNull(parsed.email, input.businessEmail) ||
      ""
    : customerRecipientOrNull(replyTo, input.businessEmail) ||
      customerRecipientOrNull(fromEmail, input.businessEmail) ||
      customerRecipientOrNull(parsed.email, input.businessEmail) ||
      "";

  const replyName = displayName(input.replyTo ?? "");
  const fromName = own ? "" : displayName(input.from);
  const labelled = parsed.name && greetingFirstName(parsed.name) ? parsed.name : "";
  const name =
    labelled ||
    (replyName && customerRecipientOrNull(replyTo, input.businessEmail) ? replyName : "") ||
    (fromName && customerRecipientOrNull(fromEmail, input.businessEmail) ? fromName : "") ||
    "Customer";

  return {
    name,
    email,
    phone: parsed.phone,
    ignored: !email,
  };
}

function displayName(from: string) {
  const name = from.replace(/<[^>]+>/g, "").trim();
  if (!name || greetingFirstName(name) === "") return "";
  return name;
}
