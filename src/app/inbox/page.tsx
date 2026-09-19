import type { Session } from "next-auth";
import { InboxTriage } from "@/components/InboxTriage";
import { auth } from "@/lib/auth";
import { isDemoMode, isGoogleConfigured } from "@/lib/env";
import { readInboxSnapshot } from "@/lib/inbox-cache";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  let session: Session | null = null;
  try {
    session = await auth();
  } catch {
    session = null;
  }

  const snapshot = await readInboxSnapshot();
  const live =
    Boolean(session?.googleConnected) && !isDemoMode() && snapshot.source === "gmail";

  return (
    <InboxTriage
      initialThreads={snapshot.threads}
      initialError={snapshot.error}
      initialSource={snapshot.source}
      initialSyncedAt={snapshot.syncedAt}
      live={live || (Boolean(session?.googleConnected) && !isDemoMode())}
      googleConfigured={isGoogleConfigured()}
    />
  );
}
