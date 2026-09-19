import { prisma } from "./prisma";
import { getGmail } from "./google";
import { createJobPhoto, sniffImageMime } from "./photo-store";
import { usablePhotoUrl } from "./photos";

const IMAGE_EXT = /\.(jpe?g|jfif|png|webp|gif)$/i;
const MIN_IMAGE_BYTES = 2048;

export type GmailPart = {
  mimeType?: string | null;
  filename?: string | null;
  body?: { attachmentId?: string | null; data?: string | null };
  parts?: GmailPart[] | null;
};

export function decodeGmailData(data: string): Buffer {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
}

export function bufferLooksLikeImage(buffer: Buffer) {
  if (buffer.length < 12) return false;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return true;
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return true;
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45
  ) {
    return true;
  }
  return Boolean(sniffImageMime("", "", buffer));
}

export function looksLikeImagePart(part: GmailPart) {
  if (!part.body?.attachmentId && !part.body?.data) return false;
  const mime = (part.mimeType ?? "").toLowerCase().split(";")[0].trim();
  const filename = part.filename ?? "";
  if (mime.includes("svg") || mime.includes("icon")) return false;
  if (mime.startsWith("image/")) return true;
  if (IMAGE_EXT.test(filename)) return true;
  if (
    (!mime ||
      mime === "application/octet-stream" ||
      mime === "application/download" ||
      mime === "application/x-download") &&
    IMAGE_EXT.test(filename)
  ) {
    return true;
  }
  return false;
}

function walkParts(part: GmailPart | undefined, found: GmailPart[]) {
  if (!part) return;
  if (looksLikeImagePart(part)) found.push(part);
  for (const child of part.parts ?? []) walkParts(child, found);
}

export function collectGmailImageParts(payload: GmailPart | undefined) {
  const found: GmailPart[] = [];
  walkParts(payload, found);
  return found;
}

export async function storeGmailImageBuffers(
  jobId: string,
  images: Array<{ buffer: Buffer; mimeType?: string | null; filename?: string | null }>,
) {
  let created = 0;
  const hasPrimary = await prisma.photo.findFirst({
    where: { jobId, isPrimary: true },
  });

  for (const image of images.slice(0, 12)) {
    if (!image.buffer || image.buffer.length < MIN_IMAGE_BYTES) continue;
    if (!bufferLooksLikeImage(image.buffer)) continue;
    const mime =
      sniffImageMime(image.mimeType, image.filename, image.buffer) || "image/jpeg";
    try {
      await createJobPhoto({
        jobId,
        buffer: image.buffer,
        mimeType: mime,
        filename: image.filename,
        source: "gmail",
        isPrimary: !hasPrimary && created === 0,
        sortOrder: created,
      });
      created += 1;
    } catch {
      // skip an attachment that is not a usable image
    }
  }

  return created;
}

export async function importGmailThreadPhotos(jobId: string, threadId?: string | null) {
  if (!threadId || threadId.startsWith("demo-")) return 0;

  try {
    const existing = await prisma.photo.findMany({
      where: { jobId, source: "gmail" },
    });
    if (existing.some((photo) => usablePhotoUrl(photo.url))) {
      return existing.length;
    }
    if (existing.length > 0) {
      await prisma.photo.deleteMany({ where: { jobId, source: "gmail" } });
    }

    const gmail = await getGmail();
    if (!gmail) return 0;

    const thread = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });

    type Found = { part: GmailPart; messageId: string };
    const found: Found[] = [];
    for (const message of thread.data.messages ?? []) {
      if (!message.id) continue;
      const bucket = collectGmailImageParts(message.payload as GmailPart | undefined);
      for (const part of bucket) found.push({ part, messageId: message.id });
    }

    const images: Array<{
      buffer: Buffer;
      mimeType?: string | null;
      filename?: string | null;
    }> = [];

    for (const { part, messageId } of found.slice(0, 12)) {
      let buffer: Buffer | null = null;
      if (part.body?.data) {
        buffer = decodeGmailData(part.body.data);
      } else if (part.body?.attachmentId) {
        const attachment = await gmail.users.messages.attachments.get({
          userId: "me",
          messageId,
          id: part.body.attachmentId,
        });
        if (attachment.data.data) {
          buffer = decodeGmailData(attachment.data.data);
        }
      }
      if (!buffer) continue;
      images.push({
        buffer,
        mimeType: part.mimeType,
        filename: part.filename,
      });
    }

    return storeGmailImageBuffers(jobId, images);
  } catch {
    return 0;
  }
}
