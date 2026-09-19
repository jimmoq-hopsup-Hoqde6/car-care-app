import { detectOutOfScope } from "./scope";

export const DEFAULT_PRICE_BANDS = [
  {
    id: "band-bumper",
    name: "Standard bumper repair",
    amount: 420,
    sortOrder: 1,
  },
  {
    id: "band-bumper-guard",
    name: "Bumper + guard",
    amount: 650,
    sortOrder: 2,
  },
  {
    id: "band-door",
    name: "Door repair and paint",
    amount: 650,
    sortOrder: 3,
  },
  {
    id: "band-guard-blend",
    name: "Colour blend on adjacent guard",
    amount: 250,
    sortOrder: 4,
  },
  {
    id: "band-trim",
    name: "Black plastic trim (replace only)",
    amount: null as number | null,
    sortOrder: 5,
  },
];

export const TRIM_EXCLUSION_ITEM =
  "Black plastic trim — replace only (not included)";

export type PriceBandLike = {
  id: string;
  name: string;
  amount?: number | null;
};

export type DetectedPanels = {
  bumper: boolean;
  guard: boolean;
  door: boolean;
  quarter: boolean;
  tailgate: boolean;
  spoiler: boolean;
  trim: boolean;
  outOfScope: boolean;
};

export function jobPricingText(input: {
  vehicle?: string | null;
  damageNotes?: string | null;
  repairItems?: string[] | string | null;
  photoNames?: Array<string | null | undefined>;
}) {
  const items = Array.isArray(input.repairItems)
    ? input.repairItems.join(" ")
    : input.repairItems ?? "";
  return [input.vehicle, input.damageNotes, items, ...(input.photoNames ?? [])]
    .filter(Boolean)
    .join(" ");
}

export function detectPanels(text: string): DetectedPanels {
  return {
    bumper: /\bbumpers?\b/i.test(text),
    guard: /\b(guards?|fenders?)\b/i.test(text),
    door: /\bdoors?\b/i.test(text),
    quarter: /\bquarters?\b/i.test(text),
    tailgate: /\btailgates?\b/i.test(text),
    spoiler: /\bspoilers?\b/i.test(text),
    trim: /\b(black\s+plastic(?:\s+trims?)?|plastic\s+trims?|mouldings?|moldings?)\b/i.test(
      text,
    ),
    outOfScope: detectOutOfScope({ damageNotes: text }),
  };
}

function amountFor(bands: PriceBandLike[], id: string, fallback: number) {
  const found = bands.find((band) => band.id === id);
  if (found?.amount != null && found.amount > 0) return found.amount;
  const seeded = DEFAULT_PRICE_BANDS.find((band) => band.id === id);
  return seeded?.amount ?? fallback;
}

export type QuoteSuggestion = {
  total: number | null;
  items: string[];
  bandIds: string[];
  internalNote: string;
  outOfScope: boolean;
};

export function suggestQuote(input: {
  vehicle?: string | null;
  damageNotes?: string | null;
  repairItems?: string[] | string | null;
  photoNames?: Array<string | null | undefined>;
  outOfScope?: boolean;
  bands?: PriceBandLike[];
}): QuoteSuggestion {
  const bands = input.bands?.length ? input.bands : DEFAULT_PRICE_BANDS;
  const text = jobPricingText(input);
  const panels = detectPanels(text);
  const outOfScope = Boolean(input.outOfScope || panels.outOfScope);

  if (outOfScope) {
    return {
      total: null,
      items: [],
      bandIds: [],
      internalNote: "Out of scope — bonnet or roof. Do not quote.",
      outOfScope: true,
    };
  }

  const items: string[] = [];
  const bandIds: string[] = [];
  let total = 0;
  let internalNote = "No matching price band yet — type the figure yourself.";

  if (panels.bumper && panels.guard && !panels.door) {
    total = amountFor(bands, "band-bumper-guard", 650);
    bandIds.push("band-bumper-guard");
    items.push("Bumper repair and paint", "Guard repair and paint");
    internalNote = "Bumper + guard quoted together.";
  } else if (panels.door && panels.guard) {
    const door = amountFor(bands, "band-door", 650);
    const blend = amountFor(bands, "band-guard-blend", 250);
    total = door + blend;
    bandIds.push("band-door", "band-guard-blend");
    items.push("Door repair and paint", "Colour blend on adjacent guard");
    internalNote = "Door plus colour blend on the adjacent guard.";
  } else if (panels.door) {
    total = amountFor(bands, "band-door", 650);
    bandIds.push("band-door");
    items.push("Door repair and paint");
    internalNote = "Door repair and paint.";
  } else if (panels.bumper) {
    total = amountFor(bands, "band-bumper", 420);
    bandIds.push("band-bumper");
    items.push("Bumper repair and paint");
    internalNote = "Standard bumper repair.";
  }

  if (panels.trim) {
    items.push(TRIM_EXCLUSION_ITEM);
    if (total > 0) {
      internalNote += " Black plastic trim is replace-only — no trim price added.";
    } else {
      internalNote =
        "Black plastic trim is replace-only. Do not invent a trim price.";
    }
  }

  return {
    total: total > 0 ? total : null,
    items,
    bandIds,
    internalNote,
    outOfScope: false,
  };
}
