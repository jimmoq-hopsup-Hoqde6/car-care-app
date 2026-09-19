import { asActivityDate } from "./activity";
import { prisma } from "./prisma";

/** Bump lastActivityAt when this event is newer than what is stored. */
export async function touchJobActivity(jobId: string, at = new Date()) {
  const when = asActivityDate(at) ?? new Date();
  await prisma.job.updateMany({
    where: {
      id: jobId,
      lastActivityAt: { lt: when },
    },
    data: { lastActivityAt: when },
  });
}
