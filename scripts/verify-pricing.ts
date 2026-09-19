import { buildQuoteEmail } from "../src/lib/quote";
import {
  DEFAULT_PRICE_BANDS,
  TRIM_EXCLUSION_ITEM,
  suggestQuote,
} from "../src/lib/pricing";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const bumper = suggestQuote({
  damageNotes: "Car park scrape across the front bumper.",
  bands: DEFAULT_PRICE_BANDS,
});
assert(bumper.total === 420, "Standard bumper should suggest $420");
assert(bumper.items.includes("Bumper repair and paint"), "Bumper line item");

const combo = suggestQuote({
  vehicle: "Mazda 6 — bumper and guard",
  damageNotes:
    "Front bumper and passenger guard both need repair and paint after a car park hit.",
  photoNames: ["mazda-bumper.jpg", "mazda-guard.jpg"],
  bands: DEFAULT_PRICE_BANDS,
});
assert(combo.total === 650, "Bumper + guard should suggest $650 together");
assert(combo.items.includes("Bumper repair and paint"), "Combo includes bumper");
assert(combo.items.includes("Guard repair and paint"), "Combo includes guard");

const door = suggestQuote({
  damageNotes: "LH front door scratch needs repair and paint.",
  bands: DEFAULT_PRICE_BANDS,
});
assert(door.total === 650, "Door repair should suggest $650");

const blend = suggestQuote({
  damageNotes: "Driver door and adjacent guard both need paint / colour blend.",
  bands: DEFAULT_PRICE_BANDS,
});
assert(blend.total === 900, "Door + guard blend should suggest $900");
assert(blend.items.includes("Colour blend on adjacent guard"), "Blend line item");

const trim = suggestQuote({
  damageNotes: "Front bumper scrape. Black plastic trim is cracked.",
  bands: DEFAULT_PRICE_BANDS,
});
assert(trim.total === 420, "Trim must not add a made-up price");
assert(trim.items.includes(TRIM_EXCLUSION_ITEM), "Trim exclusion is noted");

const oos = suggestQuote({
  damageNotes: "Scratches on bonnet, ceramic coating has been applied.",
  bands: DEFAULT_PRICE_BANDS,
});
assert(oos.outOfScope, "Bonnet must not get a price suggestion");
assert(oos.total == null, "Out-of-scope jobs have no suggested total");

const tailgate = suggestQuote({
  damageNotes: "Scratch on the tailgate spoiler.",
  bands: DEFAULT_PRICE_BANDS,
});
assert(!tailgate.outOfScope, "Tailgate spoiler is in scope");

const email = buildQuoteEmail({
  customerName: "Alex Rowe",
  repairItems: combo.items,
  total: combo.total ?? 0,
});
assert(email.includes("• Bumper repair and paint"), "Email can list accepted items");
assert(email.includes("• Estimated total: $650.00"), "Accepted total can appear after Accept");
assert(!/assure|grech|normally \$420|quoted together/i.test(email), "Email must not include internal rationale");
assert(!email.includes(combo.internalNote), "Internal suggestion note must stay off the email");

console.log(JSON.stringify({ ok: true, bumper: bumper.total, combo: combo.total }, null, 2));
