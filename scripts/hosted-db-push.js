/**
 * On a hosted Postgres URL, create/update tables at build time so the
 * first Vercel deploy is usable. Local SQLite is handled by `npm run setup`.
 */
const { spawnSync } = require("child_process");

const url = process.env.DATABASE_URL || "";
const isPostgres = /^(postgres|postgresql):/i.test(url);

if (!isPostgres) {
  console.log("DATABASE_URL is not Postgres — skipping hosted db push.");
  process.exit(0);
}

const result = spawnSync(
  "npx",
  ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"],
  { stdio: "inherit", env: process.env },
);
process.exit(result.status ?? 1);
