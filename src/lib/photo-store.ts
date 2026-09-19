import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 8 * 1024 * 1024;

export function uploadsDir(jobId: string) {
  return path.join(process.cwd(), "public", "uploads", jobId);
}

/** Vercel disk is ephemeral / read-only. Persist bytes in Neon instead. */
export function persistPhotosInDatabase() {
  return Boolean(process.env.VERCEL) || process.env.PHOTO_STORE === "database";
}

export async function saveJobImageFile(input: {
  jobId: string;
  buffer: Buffer;
  mimeType: string;
  filename?: string | null;
}) {
  const mime = input.mimeType.toLowerCase();
  if (!ALLOWED.has(mime)) {
    throw new Error("Use a JPEG, PNG, WebP or GIF photo.");
  }
  if (input.buffer.length > MAX_BYTES) {
    throw new Error("That photo is larger than 8 MB.");
  }
  const ext =
    EXT[mime] ??
    path.extname(input.filename ?? "").replace(".", "") ??
    "jpg";
  const filename = input.filename?.slice(0, 120) || `${Date.now()}.${ext}`;

  if (persistPhotosInDatabase()) {
    return { url: "", filename, mimeType: mime, bytes: input.buffer };
  }

  const safe = `${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  const dir = uploadsDir(input.jobId);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, safe), input.buffer);
    return {
      url: `/uploads/${input.jobId}/${safe}`,
      filename,
      mimeType: mime,
      bytes: null as Buffer | null,
    };
  } catch {
    // Read-only host — keep the photo in the database instead of failing.
    return { url: "", filename, mimeType: mime, bytes: input.buffer };
  }
}

export async function createJobPhoto(input: {
  jobId: string;
  buffer: Buffer;
  mimeType: string;
  filename?: string | null;
  source?: string;
  isPrimary?: boolean;
  sortOrder?: number;
}) {
  const saved = await saveJobImageFile(input);
  const photo = await prisma.photo.create({
    data: {
      jobId: input.jobId,
      url: saved.url || "pending",
      filename: saved.filename,
      source: input.source ?? "upload",
      mimeType: saved.mimeType,
      bytes: saved.bytes ? Uint8Array.from(saved.bytes) : undefined,
      isPrimary: input.isPrimary ?? false,
      sortOrder: input.sortOrder ?? 0,
    },
  });
  if (saved.url) return photo;
  return prisma.photo.update({
    where: { id: photo.id },
    data: { url: `/api/photos/${photo.id}` },
  });
}
