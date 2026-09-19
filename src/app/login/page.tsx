import Link from "next/link";
import { signIn } from "@/lib/auth";
import { BrandLogo } from "@/components/BrandLogo";
import {
  allowedEmails,
  isDemoMode,
  isGoogleConfigured,
  isLoginRequired,
} from "@/lib/env";

function safeCallback(url?: string) {
  if (!url) return "/";
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return "/";
}

function errorCopy(code?: string) {
  if (code === "AccessDenied") {
    return "That Google account is not on the allowlist. Sign in with a Marcel business address.";
  }
  if (code === "Configuration") {
    return "Google Sign-In is not configured yet. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and AUTH_SECRET (or NEXTAUTH_SECRET) on the host.";
  }
  if (code === "OAuthAccountNotLinked" || code === "OAuthCallback") {
    return "Google Sign-In did not finish. Try again, or check the authorised redirect URI on the Google Cloud client.";
  }
  if (code) {
    return "Sign-in did not complete. Try again.";
  }
  return null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const message = errorCopy(params.error);
  const callbackUrl = safeCallback(params.callbackUrl);
  const gated = isLoginRequired();
  const googleReady = isGoogleConfigured();
  const allowlist = allowedEmails();

  return (
    <div className="flex min-h-full flex-col bg-black text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <div className="mb-8">
          <BrandLogo className="h-14 w-auto max-w-full object-contain object-left sm:h-16" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Job desk</h1>
        <p className="mt-2 text-sm text-white/75">
          Sign in with Google. Only Marcel&apos;s business accounts can open
          this desk on the web.
        </p>

        {message ? (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-amber-400/40 bg-amber-400/15 px-3 py-2 text-sm text-amber-100"
          >
            {message}
          </p>
        ) : null}

        {googleReady ? (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: callbackUrl });
            }}
            className="mt-6"
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-teal px-4 py-3 text-sm font-semibold text-ink hover:bg-teal/90"
            >
              Sign in with Google
            </button>
          </form>
        ) : (
          <p className="mt-6 rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white/80">
            Google Sign-In is not set up on this host yet. Add the OAuth client
            ID and secret, then redeploy. See{" "}
            <span className="font-medium text-teal">
              Deploy for phone access
            </span>{" "}
            in the README.
          </p>
        )}

        <p className="mt-6 text-xs leading-relaxed text-white/50">
          Allowlist (from{" "}
          <code className="text-white/70">AUTH_ALLOWLIST</code>
          ): {allowlist.join(", ")}.
        </p>

        {!gated ? (
          <p className="mt-6 text-sm text-white/70">
            {isDemoMode()
              ? "Demo mode is open — you can use the desk without signing in."
              : "Login is not required on this host (no AUTH_SECRET / NEXTAUTH_SECRET)."}{" "}
            <Link href="/" className="font-medium text-teal underline">
              Open the job board
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
