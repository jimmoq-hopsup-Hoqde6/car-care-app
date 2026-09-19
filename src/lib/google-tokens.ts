import { google } from "googleapis";
import { isGoogleConfigured } from "./env";
import { prisma } from "./prisma";

export async function persistGoogleAccount(input: {
  email?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
}) {
  const existing = await prisma.googleAccount.findUnique({
    where: { id: "default" },
  });
  await prisma.googleAccount.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      email: input.email ?? null,
      accessToken: input.accessToken ?? null,
      refreshToken: input.refreshToken ?? null,
      expiresAt: input.expiresAt ?? null,
    },
    update: {
      email: input.email ?? existing?.email ?? null,
      accessToken: input.accessToken ?? existing?.accessToken ?? null,
      refreshToken: input.refreshToken ?? existing?.refreshToken ?? null,
      expiresAt: input.expiresAt ?? existing?.expiresAt ?? null,
    },
  });
}

export async function getStoredOAuthClient() {
  if (!isGoogleConfigured()) return null;
  const row = await prisma.googleAccount.findUnique({
    where: { id: "default" },
  });
  if (!row?.refreshToken && !row?.accessToken) return null;

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  client.setCredentials({
    access_token: row.accessToken ?? undefined,
    refresh_token: row.refreshToken ?? undefined,
    expiry_date: row.expiresAt ? row.expiresAt * 1000 : undefined,
  });

  const expiring =
    !row.expiresAt || Date.now() > row.expiresAt * 1000 - 60_000;
  if (expiring && row.refreshToken) {
    try {
      const refreshed = await client.refreshAccessToken();
      const creds = refreshed.credentials;
      await persistGoogleAccount({
        email: row.email,
        accessToken: creds.access_token,
        refreshToken: creds.refresh_token ?? row.refreshToken,
        expiresAt: creds.expiry_date
          ? Math.floor(creds.expiry_date / 1000)
          : null,
      });
      client.setCredentials(creds);
    } catch {
      return client;
    }
  }

  return client;
}
