"use client";

import { useState } from "react";

/** Damage photo that never shows a broken image. */
export function PhotoFrame({
  src,
  alt,
  className,
  emptyLabel = "No damage photo",
  children,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  emptyLabel?: string;
  children?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const url = src?.trim() ?? "";
  const show = url.length > 0 && !failed;

  return (
    <div className={`relative overflow-hidden bg-stone-100 ${className ?? ""}`}>
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center px-3 text-center">
          <p className="text-xs font-semibold text-stone-500">{emptyLabel}</p>
        </div>
      )}
      {children}
    </div>
  );
}
