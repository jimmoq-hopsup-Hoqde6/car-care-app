import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { isGoogleConfigured } from "./env";
import { persistGoogleAccount } from "./google-tokens";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        try {
          await persistGoogleAccount({
            email: token.email,
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            expiresAt: account.expires_at,
          });
        } catch {
          // JWT still holds the session tokens if the local store is unavailable.
        }
        return token;
      }

      if (
        token.expiresAt &&
        Date.now() < Number(token.expiresAt) * 1000 - 60_000
      ) {
        return token;
      }

      if (!token.refreshToken || !isGoogleConfigured()) {
        return token;
      }

      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: String(token.refreshToken),
          }),
        });
        const refreshed = (await response.json()) as {
          access_token?: string;
          expires_in?: number;
        };
        if (!response.ok || !refreshed.access_token) {
          return token;
        }
        token.accessToken = refreshed.access_token;
        token.expiresAt =
          Math.floor(Date.now() / 1000) + (refreshed.expires_in ?? 3600);
      } catch {
        // Keep the existing token; API calls will surface a reconnect prompt.
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.googleConnected = Boolean(token.accessToken);
      return session;
    },
  },
});
