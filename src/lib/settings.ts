import { ADELAIDE_TZ, DEFAULT_GOOGLE_REVIEW_URL } from "./constants";
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
    followUpDays: row.followUpDays || 2,
    reviewAskDaysAfterJob: row.reviewAskDaysAfterJob || 1,
    autoAskPhotos: row.autoAskPhotos !== false,
    autoDeclineOutOfScope: Boolean(row.autoDeclineOutOfScope),
    autoSmsPhotoAsk: Boolean(row.autoSmsPhotoAsk),
    autoSmsFollowUp: Boolean(row.autoSmsFollowUp),
    autoAddInboxToBoard: row.autoAddInboxToBoard !== false,
    hasMessageMediaKey: Boolean(
      process.env.MESSAGEMEDIA_API_KEY?.trim() || row.messageMediaKey,
    ),
    hasMessageMediaSecret: Boolean(
      process.env.MESSAGEMEDIA_API_SECRET?.trim() || row.messageMediaSecret,
    ),
    googleReviewUrl:
      row.googleReviewUrl && !row.googleReviewUrl.includes("PLACEHOLDER")
        ? row.googleReviewUrl
        : process.env.GOOGLE_REVIEW_URL?.trim() || DEFAULT_GOOGLE_REVIEW_URL,
  };
}
