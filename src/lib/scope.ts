/** Marcel repairs doors, bumpers, guards, quarters, tailgates and spoilers.
 *  Bonnets and roofs are the only out-of-scope panels. */

const TAILGATE = /\b(tailgates?|spoilers?)\b/i;
const HORIZONTAL = /\b(bonnets?|hoods?|roofs?)\b/i;

export function jobScopeText(input: {
  vehicle?: string | null;
  suburb?: string | null;
  damageNotes?: string | null;
  repairItems?: string | string[] | null;
  subject?: string | null;
}) {
  const items = Array.isArray(input.repairItems)
    ? input.repairItems.join(" ")
    : input.repairItems ?? "";
  return [input.vehicle, input.suburb, input.damageNotes, items, input.subject]
    .filter(Boolean)
    .join(" ");
}

export function isOutOfScopePanel(text: string) {
  const withoutTailgate = text.replace(TAILGATE, " ");
  return HORIZONTAL.test(withoutTailgate);
}

export function detectOutOfScope(input: {
  vehicle?: string | null;
  suburb?: string | null;
  damageNotes?: string | null;
  repairItems?: string | string[] | null;
  subject?: string | null;
}) {
  return isOutOfScopePanel(jobScopeText(input));
}
