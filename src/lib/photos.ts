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
