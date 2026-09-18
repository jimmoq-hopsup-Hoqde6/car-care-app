import { formatAUD } from "./money";

export type QuoteInput = {
  repairItems: string[];
  total: number;
};

export function buildQuoteEmail({ repairItems, total }: QuoteInput) {
  const items = repairItems
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `• ${item}`)
    .join("\n");

  return `Thanks for getting in touch and sharing images.

${items || "• Repair as discussed"}

Estimated total: ${formatAUD(total)}

I use digital colour-matching technology so the repair blends with the surrounding paintwork.

An onsite inspection confirms the final price if more work is needed.

All work is covered by a lifetime workmanship guarantee.

If you'd like to proceed, please let me know your preferred repair dates.

I'll need a suitable off-street location, access to a power point, and adequate natural light.

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

export function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
