"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-12">
      <h1 className="text-2xl font-semibold text-ink">
        The desk hit a snag
      </h1>
      <p className="text-sm text-stone-600">
        Gmail, Calendar or the database may be unreachable. This is not a
        customer email — nothing was sent. Reconnect Google in Settings if it
        keeps happening.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex min-h-11 items-center rounded-full bg-teal px-4 py-2.5 text-sm font-semibold text-ink"
        >
          Try again
        </button>
        <a
          href="/settings"
          className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink"
        >
          Open Settings
        </a>
        <a
          href="/"
          className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink"
        >
          Job board
        </a>
      </div>
    </div>
  );
}
