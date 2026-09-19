import { prisma } from "./prisma";
import { getGmail } from "./google";
import { saveJobImageFile } from "./photo-store";

const IMAGE = /^image\/(jpeg|jpg|png|webp|gif)$/i;

type GmailPart = {
  mimeType?: string | null;
  filename?: string | null;
  body?: { attachmentId?: string | null; data?: string | null };
  parts?: GmailPart[] | null;
};

function walkParts(part: GmailPart | undefined, found: GmailPart[]) {
  if (!part) return;
  if (part.mimeType && IMAGE.test(part.mimeType) && (part.body?.attachmentId || part.body?.data)) {
    found.push(part);
  }
  for (const child of part.parts ?? []) walkParts(child, found);
}

export async function importGmailThreadPhotos(jobId: string, threadId?: string | null) {
  if (!threadId || threadId.startsWith("demo-")) return 0;
  const gmail = await getGmail();
  if (!gmail) return 0;

  const existing = await prisma.photo.count({ where: { jobId, source: "gmail" } });
  if (existing > 0) return 0;

  const thread = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
  });

  type Found = { part: GmailPart; messageId: string };
  const found: Found[] = [];
  for (const message of thread.data.messages ?? []) {
    if (!message.id) continue;
    const bucket: GmailPart[] = [];
    walkParts(message.payload as GmailPart | undefined, bucket);
    for (const part of bucket) found.push({ part, messageId: message.id });
  }

  let created = 0;
  const hasPrimary = await prisma.photo.findFirst({
    where: { jobId, isPrimary: true },
  });

  for (const { part, messageId } of found.slice(0, 12)) {
    let buffer: Buffer | null = null;
    if (part.body?.data) {
      buffer = Buffer.from(part.body.data, "base64url");
    } else if (part.body?.attachmentId) {
      const attachment = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId,
        id: part.body.attachmentId,
      });
      if (attachment.data.data) {
        buffer = Buffer.from(attachment.data.data, "base64url");
      }
    }
    if (!buffer) continue;
    try {
      const saved = await saveJobImageFile({
        jobId,
        buffer,
        mimeType: part.mimeType ?? "image/jpeg",
        filename: part.filename,
      });
      await prisma.photo.create({
        data: {
          jobId,
          url: saved.url,
          filename: saved.filename,
          source: "gmail",
          isPrimary: !hasPrimary && created === 0,
          sortOrder: created,
        },
      });
      created += 1;
    } catch {
      // skip an attachment that is not a usable image
    }
  }

  return created;
}
