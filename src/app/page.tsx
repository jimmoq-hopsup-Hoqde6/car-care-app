import { JobBoard } from "@/components/JobBoard";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const jobs = await prisma.job.findMany({
    include: { photos: true },
    orderBy: { updatedAt: "desc" },
  });

  return <JobBoard jobs={jobs} />;
}
