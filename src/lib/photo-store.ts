import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

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
  const safe = `${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  const dir = uploadsDir(input.jobId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, safe), input.buffer);
  return {
    url: `/uploads/${input.jobId}/${safe}`,
    filename: input.filename?.slice(0, 120) || safe,
  };
}
