import { addPriceBandAction, saveSettingsAction } from "@/app/actions/settings";
import { RunAutomationsButton } from "@/components/RunAutomationsButton";
import { SyncInboxButton } from "@/components/SyncInboxButton";
import { auth, signIn } from "@/lib/auth";
import type { Session } from "next-auth";
import { getConnectionHealth } from "@/lib/connection-health";
import { GOOGLE_SCOPES, OWNER_MOBILE } from "@/lib/constants";
import { formatAuMobile, OWNER_MOBILE_E164 } from "@/lib/phone";
import {
  getSmsCredentials,
  PRODUCTION_SMS_WEBHOOK,
  smsWebhookUrl,
} from "@/lib/sms/provider";
import { DESK_LABELS } from "@/lib/gmail-labels";
import {
  allowedEmails,
  isDemoMode,
  isGoogleConfigured,
  isLoginRequired,
} from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

const DAY_LABELS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export default async function SettingsPage() {
  let settings;
  try {
    settings = await getSettings();
  } catch {
    return (
      <div className="desk-card border-amber-200 bg-amber-50 p-6">
        <h1 className="text-xl font-semibold text-ink">Settings could not load</h1>
        <p className="mt-2 text-sm text-muted">
          The database may be unreachable. Try again in a moment.
        </p>
      </div>
    );
  }
  let bands: Awaited<ReturnType<typeof prisma.priceBand.findMany>> = [];
  let events: Array<{
    id: string;
    type: string;
    delivered: boolean;
    demo: boolean;
    job: { customerName: string };
  }> = [];
  try {
    [bands, events] = await Promise.all([
      prisma.priceBand.findMany({
        orderBy: { sortOrder: "asc" },
      }),
      prisma.automationEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { job: { select: { customerName: true } } },
      }),
    ]);
  } catch {
    bands = [];
    events = [];
  }

  let session: Session | null = null;
  try {
    session = await auth();
  } catch {
    session = null;
  }

  let health;
  try {
    health = await getConnectionHealth({
      sessionEmail: session?.user?.email,
      googleConnected: Boolean(session?.googleConnected),
    });
  } catch {
    health = { demo: isDemoMode(), rows: [] };
  }

  let smsConfigured = Boolean(
    settings.hasMessageMediaKey && settings.hasMessageMediaSecret,
  );
  try {
    smsConfigured = (await getSmsCredentials()).configured;
  } catch {
    smsConfigured = false;
  }
  const webhook = smsWebhookUrl();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted">
          Hours, job length, and the price bands you choose to store. The app
          still never fills a customer quote for you.
        </p>
      </div>

      <section className="desk-card p-4">
        <h2 className="font-semibold text-ink">Connection health</h2>
        <p className="mt-1 text-sm text-muted">
          After Google sign-in on a hosted desk, tap Sync inbox now so Neon is
          not stuck on All (0).
        </p>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
          {health.rows.map((row) => (
            <li
              key={row.id}
              className="flex items-start justify-between gap-3 px-3.5 py-3 text-sm"
            >
              <span className="flex min-w-0 gap-3">
                <span
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                    row.ok ? "bg-teal" : "bg-amber-400"
                  }`}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="font-semibold text-ink">{row.label}</span>
                  <span className="mt-0.5 block text-muted">{row.detail}</span>
                </span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  row.ok
                    ? "bg-teal/15 text-teal-dark"
                    : "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80"
                }`}
              >
                {row.ok ? "OK" : "Check"}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <SyncInboxButton />
        </div>
      </section>

      <section className="desk-card p-4">
        <h2 className="font-semibold text-ink">Google</h2>
        <p className="mt-1 text-sm text-stone-600">
          {isLoginRequired()
            ? "This hosted desk is gated. Sign in with an allowlisted Google account. The same sign-in can connect Gmail and Calendar."
            : isGoogleConfigured()
              ? isDemoMode()
                ? "OAuth keys are present, but DEMO_MODE is on. Local demo stays open without login. Set DEMO_MODE=false once you host the desk."
                : "Keys are configured. Use Connect Google in the header."
              : "No OAuth keys yet. Copy .env.example to .env and add your Google client ID and secret."}
        </p>
        <p className="mt-2 text-xs text-stone-500">
          Who can sign in ({isLoginRequired() ? "login required" : "login not required here"}
          ): {allowedEmails().join(", ")}. Change{" "}
          <code>AUTH_ALLOWLIST</code> on the host — it is not edited here.
        </p>
        <ul className="mt-3 list-disc pl-5 text-xs text-stone-500">
          {GOOGLE_SCOPES.map((scope) => (
            <li key={scope}>{scope}</li>
          ))}
        </ul>
        {isGoogleConfigured() ? (
          <form
            action={async () => {
              "use server";
              await signIn("google");
            }}
            className="mt-3"
          >
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white"
            >
              Connect Google
            </button>
          </form>
        ) : null}
      </section>

      <section className="desk-card p-4">
        <h2 className="font-semibold text-ink">Gmail job-desk labels</h2>
        <p className="mt-1 text-sm text-stone-600">
          When a job moves stage, the matching label is applied to the thread
          and the other four are removed. Changing a label never emails the
          customer. Missing labels are created on first sync.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {DESK_LABELS.map((label) => (
            <li key={label.key}>
              <span className="font-medium text-ink">{label.name}</span>
              <span className="text-stone-500"> — {label.help}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="desk-card p-4">
        <h2 className="font-semibold text-ink">Automations</h2>
        <p className="mt-1 text-sm text-stone-600">
          Quotes and booking confirmations still need you to press Send. A
          follow-up, review ask, and missing-photo request may send on their
          own. Out-of-scope declines stay as drafts unless you turn auto-decline
          on.
        </p>
        <p className="mt-2 text-xs text-stone-500">
          Demo mode queues those emails on the job and never sends them. Live
          mode uses the connected Gmail account via{" "}
          <code className="rounded bg-stone-100 px-1">npm run automations:run</code>
          , this button, or Vercel Cron (`vercel.json`, 22:30 UTC / Adelaide
          morning). If a daily run 401s, set <code>CRON_SECRET</code> to the
          same value as <code>AUTOMATIONS_SECRET</code> on the host.
        </p>
        <div className="mt-3">
          <RunAutomationsButton />
        </div>
        {events.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm">
            {events.map((event) => (
              <li key={event.id} className="rounded-xl bg-white px-3 py-2">
                <span className="font-medium">{event.job.customerName}</span>
                {" · "}
                {event.type === "follow_up"
                  ? "Follow-up"
                  : event.type === "review_ask"
                    ? "Review ask"
                    : event.type === "photo_ask"
                      ? "Photo ask"
                      : event.type === "scope_decline"
                        ? "Out-of-scope decline"
                        : event.type}
                {" · "}
                {event.delivered ? "emailed" : event.demo ? "demo queue" : "not sent"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-stone-500">No automation runs yet.</p>
        )}
      </section>

      <form action={saveSettingsAction} className="desk-card space-y-4 p-4">
        <h2 className="font-semibold text-ink">Business hours (Adelaide)</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            Start hour
            <input
              name="workStartHour"
              type="number"
              min={5}
              max={16}
              defaultValue={settings.workStartHour}
              className="mt-1 w-full rounded-xl border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm">
            End hour
            <input
              name="workEndHour"
              type="number"
              min={10}
              max={20}
              defaultValue={settings.workEndHour}
              className="mt-1 w-full rounded-xl border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm col-span-2">
            Job length (hours)
            <input
              name="jobDurationHours"
              type="number"
              min={1}
              max={8}
              defaultValue={settings.jobDurationHours}
              className="mt-1 w-full rounded-xl border border-line px-3 py-2"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          {DAY_LABELS.map((day) => (
            <label key={day.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={`workDay-${day.value}`}
                defaultChecked={settings.workDays.includes(day.value)}
              />
              {day.label}
            </label>
          ))}
        </div>
        <label className="block text-sm">
          Owner name
          <input
            name="ownerName"
            defaultValue={settings.ownerName}
            className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          />
        </label>
        <p className="rounded-xl bg-stone-100/80 px-3 py-2 text-sm text-muted">
          Owner mobile (fixed — the only SMS number):{" "}
          <span className="font-semibold text-ink">
            {formatAuMobile(OWNER_MOBILE)} / {OWNER_MOBILE_E164}
          </span>
          . Authorise this as “My own numbers” in MessageMedia. No WhatsApp.
        </p>
        <label className="block text-sm">
          Business name
          <input
            name="businessName"
            defaultValue={settings.businessName}
            className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          From email
          <input
            name="businessEmail"
            defaultValue={settings.businessEmail}
            className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          />
        </label>

        <h3 className="pt-2 font-semibold text-ink">Quote intake</h3>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="autoAskPhotos"
            defaultChecked={settings.autoAskPhotos}
            className="mt-1"
          />
          <span>
            Prepare a photo-ask <strong>draft</strong> when an in-scope quote
            has no pictures. Default off. Never auto-sends. Never emails Google
            alerts, Sinch, no-reply, or info@ — only the customer&apos;s
            address (website form Reply-To / Email field, or their inbound
            From). Bonnet and roof never get a photo-ask.
          </span>
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="autoAddInboxToBoard"
            defaultChecked={settings.autoAddInboxToBoard}
            className="mt-1"
          />
          <span>
            Auto-add inbox to board. Default on. Quote requests, website forms,
            booking replies and SMS land on the board when you open Inbox (and
            on the daily automation run). Marketing, Google alerts, and Sinch
            are never added. Website forms that arrive from info@ still import —
            the job uses the customer&apos;s Email / Reply-To, never info@.
          </span>
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="autoDeclineOutOfScope"
            defaultChecked={settings.autoDeclineOutOfScope}
            className="mt-1"
          />
          <span>
            Auto-send out-of-scope declines for bonnet or roof jobs. Off by
            default — a draft is prepared for you to send.
          </span>
        </label>

        <h3 className="pt-2 font-semibold text-ink">SMS (MessageMedia)</h3>
        <p
          className={`mt-2 rounded-xl px-3 py-2 text-sm ${
            smsConfigured
              ? "bg-teal/10 text-ink"
              : "bg-amber-50 text-ink"
          }`}
        >
          {smsConfigured
            ? "MessageMedia is configured (env keys or saved Settings secrets)."
            : "MessageMedia is not configured — texts save on the job but will not send live."}{" "}
          Owner mobile {formatAuMobile(OWNER_MOBILE)} / {OWNER_MOBILE_E164}.
        </p>
        <p className="mt-2 text-xs text-stone-500">
          Inbound webhook on this host: <code>{webhook}</code>
        </p>
        <p className="mt-1 text-xs text-stone-500">
          Production Vercel webhook:{" "}
          <code>{PRODUCTION_SMS_WEBHOOK}</code>
        </p>
        <p className="mt-1 text-xs text-stone-500">
          Quotes and booking confirms never auto-text. If send fails with an
          unauthorised number, add 0435 222 221 under MessageMedia Numbers → My
          own numbers.
        </p>
        <label className="mt-2 block text-sm">
          MessageMedia API key
          <input
            type="password"
            name="messageMediaKey"
            autoComplete="off"
            placeholder={
              settings.hasMessageMediaKey
                ? "Saved — leave blank to keep"
                : "API key"
            }
            className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          />
        </label>
        <label className="mt-2 block text-sm">
          MessageMedia API secret
          <input
            type="password"
            name="messageMediaSecret"
            autoComplete="off"
            placeholder={
              settings.hasMessageMediaSecret
                ? "Saved — leave blank to keep"
                : "API secret"
            }
            className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          />
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="autoSmsPhotoAsk"
            defaultChecked={settings.autoSmsPhotoAsk}
            className="mt-1"
          />
          <span>
            Also send photo-asks by SMS. Default off until you turn it on.
          </span>
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="autoSmsFollowUp"
            defaultChecked={settings.autoSmsFollowUp}
            className="mt-1"
          />
          <span>
            Also send stalled follow-ups by SMS. Default off until you turn it
            on.
          </span>
        </label>

        <h3 className="pt-2 font-semibold text-ink">Automation timing</h3>
        <p className="text-xs text-stone-500">
          These only apply to follow-ups and review asks. You can also pin them
          in <code>.env</code> on first setup.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            Follow-up after (days)
            <input
              name="followUpDays"
              type="number"
              min={1}
              max={30}
              defaultValue={settings.followUpDays}
              className="mt-1 w-full rounded-xl border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Review ask after done (days)
            <input
              name="reviewAskDaysAfterJob"
              type="number"
              min={0}
              max={30}
              defaultValue={settings.reviewAskDaysAfterJob}
              className="mt-1 w-full rounded-xl border border-line px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm">
          Google review URL
          <input
            name="googleReviewUrl"
            defaultValue={settings.googleReviewUrl}
            className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          />
          <span className="mt-1 block text-xs text-stone-500">
            Default is Marcel&apos;s Maps review link. Change this if Google
            gives you a new one.
          </span>
        </label>

        <h3 className="pt-2 font-semibold text-ink">Price bands</h3>
        <p className="text-xs text-stone-500">
          Internal shortcuts for quote suggestions (bumper $420, bumper + guard
          $650, door $650, guard blend +$250). Suggested totals never go into a
          customer email until you Accept and then Save draft or Send. Leave
          trim blank — replace only, do not invent a price.
        </p>
        <div className="space-y-2">
          {bands.map((band) => (
            <div key={band.id} className="grid grid-cols-[1fr_7rem] gap-2">
              <input
                name={`band-name-${band.id}`}
                defaultValue={band.name}
                className="rounded-xl border border-line px-3 py-2 text-sm"
              />
              <input
                name={`band-amount-${band.id}`}
                defaultValue={band.amount ?? ""}
                placeholder="$"
                className="rounded-xl border border-line px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
        <button
          type="submit"
          className="desk-btn min-h-12 bg-teal text-ink"
        >
          Save settings
        </button>
      </form>

      <form action={addPriceBandAction} className="flex gap-2">
        <input
          name="newBandName"
          placeholder="New band name"
          className="flex-1 rounded-xl border border-line px-3 py-2 text-sm"
        />
        <input
          name="newBandAmount"
          placeholder="$ optional"
          className="w-28 rounded-xl border border-line px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
        >
          Add
        </button>
      </form>
    </div>
  );
}
