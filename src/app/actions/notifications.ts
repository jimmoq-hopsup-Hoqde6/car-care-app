"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function markNotificationRead(id: string) {
  await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
  revalidatePath("/");
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  await prisma.notification.updateMany({
    where: { readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/");
  revalidatePath("/notifications");
}
