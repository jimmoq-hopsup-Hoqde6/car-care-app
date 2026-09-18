import Link from "next/link";

export default function JobNotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold text-ink">Job not found</h1>
      <Link href="/" className="mt-4 inline-block text-sm font-medium text-teal">
        Back to the job board
      </Link>
    </div>
  );
}
