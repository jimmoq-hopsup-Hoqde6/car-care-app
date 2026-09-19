import { addPriceBandAction, saveSettingsAction } from "@/app/actions/settings";
import { RunAutomationsButton } from "@/components/RunAutomationsButton";
import { signIn } from "@/lib/auth";
import { GOOGLE_SCOPES, OWNER_MOBILE } from "@/lib/constants";
import { formatAuMobile, OWNER_MOBILE_E164 } from "@/lib/phone";
import { smsWebhookUrl } from "@/lib/sms/provider";
import { DESK_LABELS } from "@/lib/gmail-labels";
import { isDemoMode, isGoogleConfigured } from "@/lib/env";
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
  const settings = await getSettings();
  const [bands, events] = await Promise.all([
    prisma.priceBand.findMany({
      orderBy: { sortOrder: "asc" },
    }),
    prisma.automationEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { job: { select: { customerName: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Settings</h1>
        <p className="text-sm text-stone-600">
          Hours, job length, and the price bands you choose to store. The app
          still never fills a customer quote for you.
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="font-semibold text-ink">Google</h2>
        <p className="mt-1 text-sm text-stone-600">
          {isGoogleConfigured()
            ? isDemoMode()
              ? "OAuth keys are present, but DEMO_MODE is on. Set DEMO_MODE=false in .env to use live Gmail and Calendar."
              : "Keys are configured. Use Connect Google in the header."
            : "No OAuth keys yet. Copy .env.example to .env and add your Google client ID and secret."}
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
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
            >
              Connect Google
            </button>
          </form>
        ) : null}
      </section>

      <section className="rounded-2xl border border-line bg-card p-4">
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

      <section className="rounded-2xl border border-line bg-card p-4">
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
          <code className="rounded bg-stone-100 px-1">npm run automations:run</code>{" "}
          or this button.
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

      <form action={saveSettingsAction} className="space-y-4 rounded-2xl border border-line bg-card p-4">
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
        <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
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
            Auto-ask for photos when missing. Default on. Sends a short reply
            asking for pictures on in-scope jobs only — never a price, and
            never on bonnet or roof.
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
        <p className="text-xs text-stone-500">
          Outbound uses <code>source_number</code> {OWNER_MOBILE_E164}. Inbound
          webhook: <code>{smsWebhookUrl()}</code>. Quotes and booking confirms
          never auto-text.
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
          className="rounded-full bg-teal px-4 py-2.5 text-sm font-semibold text-ink"
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
