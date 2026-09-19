"use server";

import { JobStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseRepairItems } from "@/lib/quote";

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

  await prisma.job.create({
    data: {
      id,
      customerName,
      customerEmail: String(formData.get("customerEmail") ?? "").trim() || null,
      customerPhone: String(formData.get("customerPhone") ?? "").trim() || null,
      vehicle: String(formData.get("vehicle") ?? "").trim() || null,
      suburb: String(formData.get("suburb") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
      damageNotes: String(formData.get("damageNotes") ?? "").trim() || null,
      repairItems: JSON.stringify(repairItems),
      channel: String(formData.get("channel") ?? "email"),
      status: JobStatus.NEEDS_QUOTE,
    },
  });

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
  revalidatePath("/");
  revalidatePath(`/jobs/${jobId}`);
}

export async function updateJobDetails(jobId: string, formData: FormData) {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      customerName: String(formData.get("customerName") ?? "").trim(),
      customerEmail: String(formData.get("customerEmail") ?? "").trim() || null,
      customerPhone: String(formData.get("customerPhone") ?? "").trim() || null,
      vehicle: String(formData.get("vehicle") ?? "").trim() || null,
      suburb: String(formData.get("suburb") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
      damageNotes: String(formData.get("damageNotes") ?? "").trim() || null,
    },
  });
  revalidatePath("/");
  revalidatePath(`/jobs/${jobId}`);
}
