import { ADELAIDE_TZ } from "./constants";
import { prisma } from "./prisma";

export async function getSettings() {
  const row =
    (await prisma.appSetting.findUnique({ where: { id: "default" } })) ??
    (await prisma.appSetting.create({ data: { id: "default" } }));

  let workDays: number[] = [1, 2, 3, 4, 5];
  try {
    const parsed = JSON.parse(row.workDays);
    if (Array.isArray(parsed)) {
      workDays = parsed.map(Number).filter((day) => day >= 0 && day <= 6);
    }
  } catch {
    // keep default weekdays
  }

  return {
    ...row,
    workDays,
    timezone: row.timezone || ADELAIDE_TZ,
  };
}
