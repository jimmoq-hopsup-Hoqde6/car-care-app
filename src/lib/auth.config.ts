import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { GOOGLE_SCOPES } from "./constants";
import {
  authSecret,
  isEmailAllowed,
  isGoogleConfigured,
  isLoginRequired,
} from "./env";

const googleProvider = isGoogleConfigured()
  ? Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: GOOGLE_SCOPES.join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    })
  : null;

export function isPublicPath(pathname: string) {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/sms")) return true;
  if (pathname.startsWith("/api/automations/run")) return true;
  if (pathname.startsWith("/api/inbox/sync")) return true;
  if (pathname.startsWith("/brand/")) return true;
  if (pathname.startsWith("/demo/")) return true;
  if (pathname.startsWith("/uploads/")) return true;
  if (pathname.startsWith("/api/photos/")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

/**
 * Edge-safe Auth.js config (no Prisma). Middleware uses this so the
 * login gate can run on Vercel without loading the SQLite/Postgres client.
 */
export const authConfig = {
  providers: googleProvider ? [googleProvider] : [],
  trustHost: true,
  secret: authSecret() || undefined,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      if (!isLoginRequired()) return true;
      const pathname = request.nextUrl.pathname;
      if (isPublicPath(pathname)) return true;
      return isEmailAllowed(auth?.user?.email);
    },
    async signIn({ user }) {
      if (!isLoginRequired()) return true;
      return isEmailAllowed(user.email);
    },
  },
} satisfies NextAuthConfig;
