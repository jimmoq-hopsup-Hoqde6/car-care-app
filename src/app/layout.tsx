import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { auth } from "@/lib/auth";
import { isDemoMode, isGoogleConfigured } from "@/lib/env";
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
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  return (
    <html
      lang="en-AU"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell
          demo={isDemoMode()}
          googleConfigured={isGoogleConfigured()}
          googleConnected={Boolean(session?.googleConnected)}
          userEmail={session?.user?.email}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
