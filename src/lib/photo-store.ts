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
const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-jpeg": "image/jpeg",
  "image/jfif": "image/jpeg",
  "image/x-png": "image/png",
};
const MAX_BYTES = 8 * 1024 * 1024;
/** Small enough to inline as a data URL so the board thumb works without /api/photos. */
const INLINE_MAX_BYTES = 400 * 1024;

export function uploadsDir(jobId: string) {
  return path.join(process.cwd(), "public", "uploads", jobId);
}

/** Vercel disk is ephemeral / read-only. Persist bytes in Neon instead. */
export function persistPhotosInDatabase() {
  return (
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.VERCEL_URL) ||
    process.env.PHOTO_STORE === "database"
  );
}

export function sniffImageMime(
  mime?: string | null,
  filename?: string | null,
  buffer?: Buffer | null,
) {
  const raw = (mime ?? "").toLowerCase().split(";")[0].trim();
  if (MIME_ALIASES[raw]) return MIME_ALIASES[raw];
  if (ALLOWED.has(raw)) return raw;
  if (buffer && buffer.length >= 12) {
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return "image/jpeg";
    }
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return "image/png";
    }
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return "image/gif";
    }
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45
    ) {
      return "image/webp";
    }
  }
  const ext = path.extname(filename ?? "").toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg" || ext === ".jfif") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "";
}

export function imageDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export async function saveJobImageFile(input: {
  jobId: string;
  buffer: Buffer;
  mimeType: string;
  filename?: string | null;
}) {
  const mime = sniffImageMime(input.mimeType, input.filename, input.buffer);
  if (!mime || !ALLOWED.has(mime)) {
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
      bytes: input.buffer,
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
  const bytes = saved.bytes ?? input.buffer;
  const inline =
    persistPhotosInDatabase() && bytes.length > 0 && bytes.length <= INLINE_MAX_BYTES;
  const dataUrl = inline ? imageDataUrl(bytes, saved.mimeType) : "";

  const payload = {
    jobId: input.jobId,
    url: saved.url || dataUrl || "pending",
    filename: saved.filename,
    source: input.source ?? "upload",
    mimeType: saved.mimeType,
    isPrimary: input.isPrimary ?? false,
    sortOrder: input.sortOrder ?? 0,
  };

  try {
    const photo = await prisma.photo.create({
      data: {
        ...payload,
        bytes: Uint8Array.from(bytes),
      },
    });
    if (saved.url || dataUrl) return photo;
    return prisma.photo.update({
      where: { id: photo.id },
      data: { url: `/api/photos/${photo.id}` },
    });
  } catch {
    // Hosted schema without Bytes, or a DB that refused the blob — inline small images.
    if (!dataUrl && bytes.length > INLINE_MAX_BYTES) {
      throw new Error("That photo could not be stored.");
    }
    return prisma.photo.create({
      data: {
        ...payload,
        url: dataUrl || imageDataUrl(bytes, saved.mimeType),
      },
    });
  }
}
