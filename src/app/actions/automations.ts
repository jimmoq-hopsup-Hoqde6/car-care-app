"use server";

import { revalidatePath } from "next/cache";
import { runAutomations } from "@/lib/automations";
import { prisma } from "@/lib/prisma";

export async function runAutomationsAction() {
  const result = await runAutomations();
  revalidatePath("/");
  revalidatePath("/settings");
  return result;
}

export async function skipFollowUpAction(jobId: string) {
  await prisma.job.update({
    where: { id: jobId },
    data: { followUpSkippedAt: new Date() },
  });
  revalidatePath("/");
  revalidatePath(`/jobs/${jobId}`);
}

export async function skipReviewAskAction(jobId: string) {
  await prisma.job.update({
    where: { id: jobId },
    data: { reviewAskSkippedAt: new Date() },
  });
  revalidatePath("/");
  revalidatePath(`/jobs/${jobId}`);
}
