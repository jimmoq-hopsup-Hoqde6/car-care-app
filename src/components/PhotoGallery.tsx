"use client";

import { useState } from "react";
import type { Photo } from "@prisma/client";
import { addJobPhotosAction, setPrimaryPhotoAction } from "@/app/actions/photos";
import { photoAlt, primaryPhoto, sortPhotos } from "@/lib/photos";

type Props = {
  jobId: string;
  photos: Photo[];
  heading?: string;
  allowUpload?: boolean;
  compact?: boolean;
};

export function PhotoGallery({
  jobId,
  photos,
  heading = "Repair photos",
  allowUpload = true,
  compact = false,
}: Props) {
  const ordered = sortPhotos(photos);
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const openIndex = ordered.findIndex((photo) => photo.id === openId);
  const openPhoto = openIndex >= 0 ? ordered[openIndex] : null;

  async function onUpload(formData: FormData) {
    setBusy(true);
    setMessage(null);
    const result = await addJobPhotosAction(jobId, formData);
    setMessage(result.message);
    setBusy(false);
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">{heading}</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            {ordered.length
              ? "Tap a photo for a full-size look before you drive out."
              : "No repair photos yet — add some so you know the panel."}
          </p>
        </div>
        {ordered.length > 1 ? (
          <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[11px] font-semibold text-teal-dark">
            {ordered.length} photos
          </span>
        ) : null}
      </div>

      {ordered.length > 0 ? (
        <div
          className={`mt-3 grid gap-2 ${
            compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"
          }`}
        >
          {ordered.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setOpenId(photo.id)}
              className="group relative overflow-hidden rounded-xl bg-stone-200 ring-1 ring-line"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photoAlt(photo)}
                className={
                  compact
                    ? "h-20 w-full object-cover"
                    : "h-36 w-full object-cover sm:h-40"
                }
              />
              {photo.isPrimary || photo.id === primaryPhoto(ordered)?.id ? (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Primary
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex h-28 items-center justify-center rounded-xl border border-dashed border-line bg-white text-sm text-stone-500">
          No repair photo
        </div>
      )}

      {allowUpload ? (
        <form action={onUpload} className="mt-3 space-y-2">
          <label className="block text-xs font-medium text-ink">
            Add photos
            <input
              name="photos"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="mt-1 block w-full text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-teal px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
          >
            {busy ? "Saving…" : "Upload photos"}
          </button>
          {message ? <p className="text-xs text-stone-600">{message}</p> : null}
        </form>
      ) : null}

      {openPhoto ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90 p-3 text-white"
          role="dialog"
          aria-modal
          aria-label="Repair photo"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {photoAlt(openPhoto)} · {openIndex + 1} of {ordered.length}
            </p>
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="rounded-full bg-white/15 px-3 py-1.5 text-sm"
            >
              Close
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={openPhoto.url}
              alt={photoAlt(openPhoto)}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={openIndex <= 0}
              onClick={() => setOpenId(ordered[openIndex - 1]?.id ?? null)}
              className="rounded-full bg-white/15 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            {openPhoto.isPrimary ? null : (
              <button
                type="button"
                onClick={() => setPrimaryPhotoAction(jobId, openPhoto.id)}
                className="rounded-full bg-teal px-3 py-1.5 text-sm font-semibold text-ink"
              >
                Use as board thumbnail
              </button>
            )}
            <button
              type="button"
              disabled={openIndex >= ordered.length - 1}
              onClick={() => setOpenId(ordered[openIndex + 1]?.id ?? null)}
              className="rounded-full bg-white/15 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
