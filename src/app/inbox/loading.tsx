export default function InboxLoading() {
  return (
    <div className="space-y-5">
      <div>
        <div className="h-8 w-40 animate-pulse rounded-lg bg-stone-200" />
        <div className="mt-2 h-4 w-full max-w-md animate-pulse rounded bg-stone-100" />
      </div>
      <div className="desk-card flex items-center gap-2 px-4 py-3 text-sm text-muted">
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-teal border-t-transparent"
          aria-hidden
        />
        Opening inbox…
      </div>
      {[0, 1, 2].map((key) => (
        <div key={key} className="desk-card space-y-3 p-4">
          <div className="h-5 w-28 animate-pulse rounded-full bg-stone-100" />
          <div className="h-5 w-3/4 animate-pulse rounded bg-stone-200" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-stone-100" />
          <div className="h-4 w-full animate-pulse rounded bg-stone-100" />
        </div>
      ))}
    </div>
  );
}
