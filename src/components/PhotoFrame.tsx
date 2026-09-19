"use client";

import { useState } from "react";

function EmptyDamagePhoto({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-stone-100 px-3 text-center">
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="h-7 w-7 text-stone-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.5 7.5h2.2l1.1-1.8h8.4l1.1 1.8h2.2A1.5 1.5 0 0 1 21 9v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V9a1.5 1.5 0 0 1 1.5-1.5Z"
        />
        <circle cx="12" cy="13.25" r="3.1" />
      </svg>
      <p className="text-xs font-semibold text-stone-500">{label}</p>
    </div>
  );
}

/** Damage photo that never shows a broken image. */
export function PhotoFrame({
  src,
  alt,
  className,
  emptyLabel = "No damage photo",
  fit = "cover",
  children,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  emptyLabel?: string;
  fit?: "cover" | "contain";
  children?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const url = src?.trim() ?? "";
  const show = url.length > 0 && url !== "pending" && !failed;

  return (
    <div className={`relative overflow-hidden bg-stone-100 ${className ?? ""}`}>
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          className={
            fit === "contain"
              ? "mx-auto max-h-full max-w-full object-contain"
              : "h-full w-full object-cover"
          }
          onError={() => setFailed(true)}
        />
      ) : (
        <EmptyDamagePhoto label={emptyLabel} />
      )}
      {children}
    </div>
  );
}
