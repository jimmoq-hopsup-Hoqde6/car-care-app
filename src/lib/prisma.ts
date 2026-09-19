import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Vercel serverless cannot persist a repo SQLite file — use /tmp if needed. */
export function resolveDatabaseUrl() {
  const raw = process.env.DATABASE_URL?.trim() || "file:./dev.db";
  if (process.env.VERCEL && /^file:/i.test(raw)) {
    return "file:/tmp/jobdesk.db";
  }
  return raw;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: resolveDatabaseUrl() } },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
