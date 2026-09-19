import { JobBoard } from "@/components/JobBoard";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export default async function HomePage() {
  const [jobs, settings] = await Promise.all([
    prisma.job.findMany({
      include: { photos: true },
      orderBy: { lastActivityAt: "desc" },
    }),
    getSettings(),
  ]);

  return <JobBoard jobs={jobs} settings={settings} />;
}
