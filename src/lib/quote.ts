import { formatAUD } from "./money";
import { greetingFirstName } from "./customer-mail";

export type QuoteInput = {
  customerName?: string | null;
  repairItems: string[];
  total: number;
};

export function firstName(fullName: string) {
  return greetingFirstName(fullName);
}

/** Never returns a bare "Hi ,". Never greets Mobile / Info / no-reply. */
export function emailGreeting(fullName?: string | null) {
  const name = greetingFirstName(fullName);
  return name ? `Hi ${name},` : "Hi there,";
}

export function buildQuoteEmail({
  customerName,
  repairItems,
  total,
}: QuoteInput) {
  const items = repairItems
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `• ${item}`);
  const itemLines = items.length ? items.join("\n") : "• Repair as discussed";

  return `${emailGreeting(customerName)}

Thanks for getting in touch and sharing the photos.

Quote
${itemLines}
• Estimated total: ${formatAUD(total)}

This quote is valid for 30 days from the date of this email.

I use digital colour-matching technology so the repair blends with the surrounding paintwork.

An onsite inspection confirms the final price if more work is needed.

All work is covered by a lifetime workmanship guarantee.

If you'd like to proceed, please reply with your preferred repair dates and a mobile number.

I'll need off-street parking, access to a power point, and adequate natural light.

Kind regards,
Marcel Kuhn
Mobile Car Scratch Repair Adelaide`;
}

export function quoteSubject(vehicle?: string | null, suburb?: string | null) {
  const bits = [vehicle, suburb].filter(Boolean);
  return bits.length
    ? `Quote — ${bits.join(" — ")}`
    : "Quote — Mobile Car Scratch Repair Adelaide";
}

export function parseRepairItems(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // stored as plain text
  }
  return value
    .split("\n")
    .map((item) => item.replace(/^[•\-]\s*/, "").trim())
    .filter(Boolean);
}

