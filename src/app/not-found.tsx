import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-sm text-stone-600">
        That job or page is not on the desk.
      </p>
      <Link
        href="/"
        className="mt-4 inline-block rounded-full bg-teal px-4 py-2 text-sm font-semibold text-ink"
      >
        Back to the job board
      </Link>
    </div>
  );
}
