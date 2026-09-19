import Link from "next/link";
import { signIn, signOut } from "@/lib/auth";
import { BrandLogo } from "./BrandLogo";
import { NotificationBell } from "./NotificationBell";

type Props = {
  children: React.ReactNode;
  demo: boolean;
  googleConfigured: boolean;
  googleConnected: boolean;
  userEmail?: string | null;
  unreadNotifications: number;
  loginRequired?: boolean;
};

const nav = [
  { href: "/", label: "Jobs" },
  { href: "/inbox", label: "Inbox" },
  { href: "/notifications", label: "Alerts" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({
  children,
  demo,
  googleConfigured,
  googleConnected,
  userEmail,
  unreadNotifications,
  loginRequired = false,
}: Props) {
  return (
    <div className="min-h-full bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="min-w-0 shrink" aria-label="Job board">
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell unread={unreadNotifications} />
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-1.5 text-sm text-white/85 hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
          </nav>
            <AuthButton
              googleConfigured={googleConfigured}
              googleConnected={googleConnected}
              userEmail={userEmail}
              loginRequired={loginRequired}
            />
          </div>
        </div>
        {demo ? (
          <p className="bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-ink">
            Demo mode — sample jobs only. Prices are never guessed. Connect Google
            in Settings to use live Gmail and Calendar.
          </p>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-5 md:pb-10">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-teal/40 bg-card/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-4">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-2 py-3 text-center text-sm font-medium text-ink"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

function AuthButton({
  googleConfigured,
  googleConnected,
  userEmail,
  loginRequired,
}: {
  googleConfigured: boolean;
  googleConnected: boolean;
  userEmail?: string | null;
  loginRequired: boolean;
}) {
  if (loginRequired && userEmail) {
    return (
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button
          type="submit"
          className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/90"
        >
          Sign out
        </button>
      </form>
    );
  }

  if (!googleConfigured) {
    return (
      <Link
        href="/settings"
        className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/90"
      >
        Connect Google
      </Link>
    );
  }

  if (googleConnected) {
    return (
      <form
        action={async () => {
          "use server";
          await signOut();
        }}
      >
        <button
          type="submit"
          className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/90"
        >
          {userEmail ? userEmail.split("@")[0] : "Disconnect"}
        </button>
      </form>
    );
  }

  return (
    <form
      action={async () => {
        "use server";
        await signIn("google");
      }}
    >
      <button
        type="submit"
        className="rounded-full bg-amber-400 px-3 py-1.5 text-sm font-semibold text-ink"
      >
        Connect Google
      </button>
    </form>
  );
}
