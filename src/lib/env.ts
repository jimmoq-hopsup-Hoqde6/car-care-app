const DEFAULT_ALLOWLIST = [
  "info@mobilecarscratchrepairadelaide.com.au",
  "moogly88@gmail.com",
];

export function isDemoMode() {
  if (process.env.DEMO_MODE === "false") return false;
  if (process.env.DEMO_MODE === "true") return true;
  return !isGoogleConfigured();
}

export function isGoogleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}

/** AUTH_SECRET or NEXTAUTH_SECRET — Auth.js v5 accepts both. */
export function authSecret() {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    ""
  );
}

export function hasAuthSecret() {
  return Boolean(authSecret());
}

/** AUTH_URL or NEXTAUTH_URL — used for OAuth redirects and SMS webhooks. */
export function authUrl() {
  return (
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000"
  );
}

/**
 * Hosted / production login gate.
 * Demo or local stays open when DEMO_MODE=true, or when there is no
 * AUTH_SECRET / NEXTAUTH_SECRET (Auth.js cannot issue a session).
 */
export function isLoginRequired() {
  if (isDemoMode()) return false;
  if (!hasAuthSecret()) return false;
  return true;
}

export function allowedEmails() {
  const raw =
    process.env.AUTH_ALLOWLIST?.trim() ||
    process.env.ALLOWED_EMAILS?.trim() ||
    "";
  const list = raw
    ? raw
        .split(/[,;\s]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    : DEFAULT_ALLOWLIST;
  return list;
}

export function isEmailAllowed(email?: string | null) {
  if (!email) return false;
  return allowedEmails().includes(email.trim().toLowerCase());
}

export function defaultAllowlist() {
  return [...DEFAULT_ALLOWLIST];
}
