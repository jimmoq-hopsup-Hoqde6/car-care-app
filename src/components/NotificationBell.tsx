import Link from "next/link";

export function NotificationBell({ unread }: { unread: number }) {
  return (
    <Link
      href="/notifications"
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
      aria-label={
        unread
          ? `${unread} unread notification${unread === 1 ? "" : "s"}`
          : "Notifications"
      }
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <path d="M6 9a6 6 0 1 1 12 0c0 7 2 7 2 9H4c0-2 2-2 2-9" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </svg>
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-amber-400 px-1 text-center text-[10px] font-bold text-ink">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
