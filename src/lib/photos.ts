export type PhotoLike = {
  id: string;
  url: string;
  filename?: string | null;
  isPrimary?: boolean;
  sortOrder?: number;
  createdAt?: Date | string;
};

export function sortPhotos<T extends PhotoLike>(photos: T[]): T[] {
  return [...photos].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    const order = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (order !== 0) return order;
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });
}

export function primaryPhoto<T extends PhotoLike>(photos: T[]): T | null {
  const sorted = sortPhotos(photos);
  return sorted[0] ?? null;
}

export function photoAlt(photo: PhotoLike, fallback = "Repair photo") {
  return photo.filename?.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ") || fallback;
}

/** Website form / email text that says the customer sent no pictures. */
export function formSaysNoPhotos(text?: string | null) {
  return /no photos uploaded|no photo uploaded|no pictures uploaded|no images uploaded|no photos attached|no photo attached/i.test(
    text ?? "",
  );
}

/** Website form / email text that says pictures were included. */
export function formSaysHasPhotos(text?: string | null) {
  if (formSaysNoPhotos(text)) return false;
  return /photos attached|photo attached|photos uploaded|pictures attached|images attached/i.test(
    text ?? "",
  );
}

export function hasUsablePhotos(
  photos: Array<{ id?: string; url?: string | null }>,
  notes?: string | null,
) {
  const hasFile = photos.some((photo) => Boolean(photo.url?.trim() || photo.id));
  if (hasFile) return true;
  return !formSaysNoPhotos(notes) && photos.length > 0;
}
