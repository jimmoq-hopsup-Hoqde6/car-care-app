import { addPriceBandAction, saveSettingsAction } from "@/app/actions/settings";
import { signIn } from "@/lib/auth";
import { GOOGLE_SCOPES } from "@/lib/constants";
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
  const bands = await prisma.priceBand.findMany({
    orderBy: { sortOrder: "asc" },
  });

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

        <h3 className="pt-2 font-semibold text-ink">Price bands</h3>
        <p className="text-xs text-stone-500">
          Optional shortcuts for you. Leave the amount blank until you decide
          the rate.
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
          className="rounded-full bg-teal px-4 py-2.5 text-sm font-semibold text-white"
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
