import { OWNER_MOBILE } from "./constants";

/** Marcel's existing mobile in E.164. No separate business SMS number. */
export const OWNER_MOBILE_E164 = "+61435222221";

export function digitsOnly(value?: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

/** Normalise an Australian mobile to E.164 (+61…). Returns null if it is not a usable AU mobile. */
export function toE164Au(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const digits = digitsOnly(value);
  if (!digits) return null;
  let national = digits;
  if (digits.startsWith("61") && digits.length >= 11) {
    national = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length >= 10) {
    national = digits.slice(1);
  }
  if (national.length === 9 && national.startsWith("4")) {
    return `+61${national}`;
  }
  return null;
}

export function formatAuMobile(value?: string | null) {
  const e164 = toE164Au(value);
  if (!e164) return value?.trim() || "";
  const national = `0${e164.slice(3)}`;
  if (national.length === 10) {
    return `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`;
  }
  return national;
}

export function ownerMobileE164() {
  return toE164Au(OWNER_MOBILE) || OWNER_MOBILE_E164;
}

export function sameAuMobile(left?: string | null, right?: string | null) {
  const a = toE164Au(left);
  const b = toE164Au(right);
  return Boolean(a && b && a === b);
}
