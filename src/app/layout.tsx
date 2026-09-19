import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { auth } from "@/lib/auth";
import {
  isDemoMode,
  isEmailAllowed,
  isGoogleConfigured,
  isLoginRequired,
} from "@/lib/env";
import { unreadNotificationCount } from "@/lib/notifications";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Job desk — Mobile Car Scratch Repair Adelaide",
  description:
    "Quote drafts and booking for Marcel Kuhn, Mobile Car Scratch Repair Adelaide.",
  icons: {
    icon: [
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch.png", sizes: "180x180" }],
    shortcut: "/favicon.ico",
  },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  const loginRequired = isLoginRequired();
  const signedIn = isEmailAllowed(session?.user?.email);
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isLoginPage = pathname === "/login" || pathname.startsWith("/login?");
  const showShell = !isLoginPage && (!loginRequired || signedIn);

  let unreadNotifications = 0;
  if (showShell) {
    try {
      unreadNotifications = await unreadNotificationCount();
    } catch {
      unreadNotifications = 0;
    }
  }

  return (
    <html
      lang="en-AU"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {showShell ? (
          <AppShell
            demo={isDemoMode()}
            googleConfigured={isGoogleConfigured()}
            googleConnected={Boolean(session?.googleConnected)}
            userEmail={session?.user?.email}
            unreadNotifications={unreadNotifications}
            loginRequired={loginRequired}
          >
            {children}
          </AppShell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
