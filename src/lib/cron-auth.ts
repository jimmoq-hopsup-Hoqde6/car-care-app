/**
 * Auth for GET/POST /api/automations/run and /api/inbox/sync.
 *
 * - No secret set: open (local demo).
 * - AUTOMATIONS_SECRET: curl / host cron send `Authorization: Bearer …`.
 * - CRON_SECRET: Vercel Cron injects `Authorization: Bearer $CRON_SECRET`
 *   automatically. Set it to the same value as AUTOMATIONS_SECRET on Vercel.
 *   Do not put the secret in vercel.json.
 */
export function cronSecrets() {
  const values = [
    process.env.AUTOMATIONS_SECRET?.trim(),
    process.env.CRON_SECRET?.trim(),
  ].filter((value): value is string => Boolean(value));
  return [...new Set(values)];
}

export function cronAuthorised(request: Request) {
  const secrets = cronSecrets();
  if (secrets.length === 0) return true;
  const header = request.headers.get("authorization");
  if (!header) return false;
  return secrets.some((secret) => header === `Bearer ${secret}`);
}
