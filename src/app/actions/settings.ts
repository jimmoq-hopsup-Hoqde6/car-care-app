"use server";

import { revalidatePath } from "next/cache";
import { parsePrice } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export async function saveSettingsAction(formData: FormData) {
  const workDays = [1, 2, 3, 4, 5, 6, 0].filter(
    (day) => formData.get(`workDay-${day}`) === "on",
  );

  await prisma.appSetting.update({
    where: { id: "default" },
    data: {
      workStartHour: Number(formData.get("workStartHour") || 8),
      workEndHour: Number(formData.get("workEndHour") || 16),
      jobDurationHours: Number(formData.get("jobDurationHours") || 3),
      workDays: JSON.stringify(workDays.length ? workDays : [1, 2, 3, 4, 5]),
      ownerName: String(formData.get("ownerName") ?? "Marcel Kuhn"),
      businessName: String(
        formData.get("businessName") ?? "Mobile Car Scratch Repair Adelaide",
      ),
      businessEmail: String(
        formData.get("businessEmail") ??
          "Info@mobilecarscratchrepairadelaide.com.au",
      ),
    },
  });

  const bands = await prisma.priceBand.findMany();
  for (const band of bands) {
    const name = String(formData.get(`band-name-${band.id}`) ?? band.name).trim();
    const amountRaw = formData.get(`band-amount-${band.id}`);
    const amount = parsePrice(amountRaw == null ? "" : String(amountRaw));
    await prisma.priceBand.update({
      where: { id: band.id },
      data: { name, amount },
    });
  }

  revalidatePath("/settings");
  revalidatePath("/");
}

export async function addPriceBandAction(formData: FormData) {
  const name = String(formData.get("newBandName") ?? "").trim();
  if (!name) return;
  const count = await prisma.priceBand.count();
  await prisma.priceBand.create({
    data: {
      name,
      amount: parsePrice(String(formData.get("newBandAmount") ?? "")),
      sortOrder: count + 1,
    },
  });
  revalidatePath("/settings");
}
