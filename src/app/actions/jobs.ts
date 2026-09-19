"use server";

import { JobStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runPhotoAndScopeAutomations } from "@/lib/automations";
import { syncJobGmailLabelById } from "@/lib/gmail-labels";
import { saveJobImageFile } from "@/lib/photo-store";
import { prisma } from "@/lib/prisma";
import { formatAuMobile, toE164Au } from "@/lib/phone";
import { parseRepairItems } from "@/lib/quote";
import { detectOutOfScope } from "@/lib/scope";

function slugId(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `job-${slug || "customer"}-${Date.now().toString(36)}`;
}

export async function createJob(formData: FormData) {
  const customerName = String(formData.get("customerName") ?? "").trim();
  if (!customerName) {
    throw new Error("Customer name is required.");
  }

  const repairItems = parseRepairItems(String(formData.get("repairItems") ?? ""));
  const id = slugId(customerName);
  const vehicle = String(formData.get("vehicle") ?? "").trim() || null;
  const suburb = String(formData.get("suburb") ?? "").trim() || null;
  const damageNotes = String(formData.get("damageNotes") ?? "").trim() || null;
  const customerPhone = String(formData.get("customerPhone") ?? "").trim() || null;
  const customerPhoneE164 = toE164Au(customerPhone);
  const outOfScope = detectOutOfScope({
    vehicle,
    suburb,
    damageNotes,
    repairItems,
  });

  await prisma.job.create({
    data: {
      id,
      customerName,
      customerEmail: String(formData.get("customerEmail") ?? "").trim() || null,
      customerPhone: customerPhone
        ? formatAuMobile(customerPhone) || customerPhone
        : null,
      customerPhoneE164,
      vehicle,
      suburb,
      address: String(formData.get("address") ?? "").trim() || null,
      damageNotes,
      repairItems: JSON.stringify(repairItems),
      channel: String(formData.get("channel") ?? "email"),
      status: JobStatus.NEEDS_QUOTE,
      lastActivityAt: new Date(),
      outOfScope,
    },
  });

  const files = formData.getAll("photos").filter((item): item is File => item instanceof File);
  let added = 0;
  for (const file of files) {
    if (!file.size) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await saveJobImageFile({
      jobId: id,
      buffer,
      mimeType: file.type || "image/jpeg",
      filename: file.name,
    });
    await prisma.photo.create({
      data: {
        jobId: id,
        url: saved.url,
        filename: saved.filename,
        source: "upload",
        isPrimary: added === 0,
        sortOrder: added,
      },
    });
    added += 1;
  }

  await runPhotoAndScopeAutomations(id);
  await syncJobGmailLabelById(id);

  revalidatePath("/");
  redirect(`/jobs/${id}`);
}

export async function updateJobStatus(jobId: string, status: JobStatus) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;
  const now = new Date();
  await prisma.job.update({
    where: { id: jobId },
    data: {
      lastActivityAt: now,
      status,
      awaitingSince:
        status === JobStatus.AWAITING_CUSTOMER
          ? (job.awaitingSince ?? now)
          : job.awaitingSince,
      completedAt:
        status === JobStatus.DONE
          ? (job.completedAt ?? now)
          : job.reviewAskSentAt
            ? job.completedAt
            : null,
    },
  });
  await syncJobGmailLabelById(jobId);
  revalidatePath("/");
  revalidatePath(`/jobs/${jobId}`);
}

export async function updateJobDetails(jobId: string, formData: FormData) {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      customerName: String(formData.get("customerName") ?? "").trim(),
      customerEmail: String(formData.get("customerEmail") ?? "").trim() || null,
      customerPhone: (() => {
        const phone = String(formData.get("customerPhone") ?? "").trim();
        return phone ? formatAuMobile(phone) || phone : null;
      })(),
      customerPhoneE164: toE164Au(String(formData.get("customerPhone") ?? "")),
      vehicle: String(formData.get("vehicle") ?? "").trim() || null,
      suburb: String(formData.get("suburb") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
      damageNotes: String(formData.get("damageNotes") ?? "").trim() || null,
    },
  });
  await runPhotoAndScopeAutomations(jobId);
  revalidatePath("/");
  revalidatePath(`/jobs/${jobId}`);
}
