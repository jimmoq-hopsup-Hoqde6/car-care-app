"use server";

import { revalidatePath } from "next/cache";
import { createJobPhoto } from "@/lib/photo-store";
import { prisma } from "@/lib/prisma";

function revalidateJob(jobId: string) {
  revalidatePath("/");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/quote`);
  revalidatePath(`/jobs/${jobId}/book`);
}

export async function addJobPhotosAction(jobId: string, formData: FormData) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { photos: true },
  });
  if (!job) return { ok: false, message: "Job not found." };

  const files = formData.getAll("photos").filter((item): item is File => item instanceof File);
  if (files.length === 0) {
    return { ok: false, message: "Choose one or more photos first." };
  }

  const hasPrimary = job.photos.some((photo) => photo.isPrimary);
  let added = 0;
  for (const file of files) {
    if (!file.size) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      await createJobPhoto({
        jobId,
        buffer,
        mimeType: file.type || "image/jpeg",
        filename: file.name,
        source: "upload",
        isPrimary: !hasPrimary && added === 0,
        sortOrder: job.photos.length + added,
      });
      added += 1;
    } catch {
      // skip a file that is not a usable image
    }
  }

  if (added === 0) {
    return { ok: false, message: "Those files could not be saved as photos." };
  }

  await prisma.job.update({
    where: { id: jobId },
    data: { lastActivityAt: new Date() },
  });
  revalidateJob(jobId);
  return {
    ok: true,
    message:
      added === 1
        ? "Repair photo added."
        : `${added} repair photos added.`,
  };
}

export async function setPrimaryPhotoAction(jobId: string, photoId: string) {
  await prisma.photo.updateMany({
    where: { jobId },
    data: { isPrimary: false },
  });
  await prisma.photo.update({
    where: { id: photoId },
    data: { isPrimary: true },
  });
  revalidateJob(jobId);
}
