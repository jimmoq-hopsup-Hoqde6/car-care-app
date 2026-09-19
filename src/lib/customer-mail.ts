import { allowedEmails } from "./env";

const BUSINESS_EMAILS = [
  "info@mobilecarscratchrepairadelaide.com.au",
  "moogly88@gmail.com",
];

const NON_CUSTOMER_DOMAINS = [
  "accounts.google.com",
  "smb.sinch.com",
  "sinch.com",
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
  if (NON_CUSTOMER_DOMAINS.some((item) => domain === item || domain.endsWith(`.${item}`))) {
    return true;
  }
  if (domain === "google.com" && /no-?reply|notify|accounts/.test(local)) return true;
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
  const parsed = extractCustomerFromBody(
    `${input.subject ?? ""}\n${input.snippet ?? ""}`,
  );
  const replyTo = normaliseEmail(input.replyTo);
  const fromEmail = normaliseEmail(input.fromEmail || input.from);

  const email =
    customerRecipientOrNull(replyTo, input.businessEmail) ||
    customerRecipientOrNull(fromEmail, input.businessEmail) ||
    customerRecipientOrNull(parsed.email, input.businessEmail) ||
    "";

  const replyName = displayName(input.replyTo ?? "");
  const fromName = displayName(input.from);
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
