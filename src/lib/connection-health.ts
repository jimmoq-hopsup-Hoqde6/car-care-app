import { isDemoMode, isGoogleConfigured } from "./env";
import { getCalendar } from "./google";
import { prisma } from "./prisma";
import { OWNER_MOBILE_E164, formatAuMobile } from "./phone";
import { OWNER_MOBILE } from "./constants";
import { getSmsCredentials } from "./sms/provider";

export type HealthRow = {
  id: string;
  ok: boolean;
  label: string;
  detail: string;
};

export type ConnectionHealth = {
  demo: boolean;
  rows: HealthRow[];
};

/**
 * Settings health — never throws. Missing APIs show as “not connected”.
 */
export async function getConnectionHealth(input?: {
  sessionEmail?: string | null;
  googleConnected?: boolean;
}): Promise<ConnectionHealth> {
  const demo = isDemoMode();
  const googleConfigured = isGoogleConfigured();

  let account: { email: string | null; refreshToken: string | null; accessToken: string | null } | null =
    null;
  try {
    account = await prisma.googleAccount.findUnique({
      where: { id: "default" },
      select: { email: true, refreshToken: true, accessToken: true },
    });
  } catch {
    account = null;
  }

  const hasToken = Boolean(account?.refreshToken || account?.accessToken);
  const loginEmail = input?.sessionEmail?.trim() || account?.email || null;
  const googleLive = Boolean(input?.googleConnected) || hasToken;

  let calendarOk = false;
  let calendarDetail = "Calendar is not connected yet.";
  if (demo) {
    calendarDetail = "Demo mode — Calendar is not called.";
  } else if (!googleConfigured) {
    calendarDetail = "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then sign in.";
  } else if (!hasToken) {
    calendarDetail = "Sign in with Google so Calendar free/busy can load.";
  } else {
    try {
      const calendar = await getCalendar();
      if (!calendar) {
        calendarDetail = "Gmail token is stored, but Calendar could not start. Reconnect Google.";
      } else {
        await calendar.calendars.get({ calendarId: "primary" });
        calendarOk = true;
        calendarDetail = "Primary calendar reachable.";
      }
    } catch {
      calendarDetail =
        "Calendar could not be reached. Reconnect Google in Settings if this keeps happening.";
    }
  }

  let sms;
  try {
    sms = await getSmsCredentials();
  } catch {
    sms = { configured: false, sourceNumber: OWNER_MOBILE_E164 };
  }

  const rows: HealthRow[] = [
    {
      id: "google-login",
      ok: Boolean(loginEmail) || (demo && !googleConfigured),
      label: "Google login",
      detail: loginEmail
        ? `Signed in as ${loginEmail}.`
        : demo
          ? "Demo is open without a Google session."
          : "Not signed in. Use Sign in with Google.",
    },
    {
      id: "gmail",
      ok: demo ? true : hasToken && googleLive,
      label: "Gmail token",
      detail: demo
        ? "Demo mode — Inbox uses sample threads. Connect Google for live Gmail."
        : hasToken
          ? `Gmail token stored${account?.email ? ` for ${account.email}` : ""}.`
          : googleConfigured
            ? "No Gmail token yet. Connect Google to sync Inbox onto the board."
            : "Google OAuth keys are missing.",
    },
    {
      id: "calendar",
      ok: demo ? true : calendarOk,
      label: "Calendar",
      detail: calendarDetail,
    },
    {
      id: "sms",
      ok: demo ? true : sms.configured,
      label: "MessageMedia",
      detail: sms.configured
        ? `API keys present. Texts send from ${formatAuMobile(OWNER_MOBILE)} (${OWNER_MOBILE_E164}).`
        : demo
          ? "Demo never calls MessageMedia. Add the API key and secret for live SMS."
          : "API key/secret missing. SMS drafts save here but will not send.",
    },
    {
      id: "mobile",
      ok: true,
      label: "Owner mobile",
      detail: `${formatAuMobile(OWNER_MOBILE)} / ${OWNER_MOBILE_E164} — the only SMS number. Authorise it under MessageMedia Numbers → My own numbers.`,
    },
  ];

  return { demo, rows };
}
