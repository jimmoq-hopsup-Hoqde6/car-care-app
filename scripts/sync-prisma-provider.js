/**
 * Prisma's schema provider is static. Local demo stays on SQLite.
 * Hosted Vercel cannot persist a SQLite file — if DATABASE_URL is
 * postgres/postgresql, rewrite the provider before generate / db push.
 */
const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
const url = process.env.DATABASE_URL || "";
const isPostgres = /^(postgres|postgresql):/i.test(url);
const provider = isPostgres ? "postgresql" : "sqlite";

let schema = fs.readFileSync(schemaPath, "utf8");
const next = schema.replace(
  /provider\s*=\s*"(sqlite|postgresql|postgres)"/,
  `provider = "${provider}"`,
);

if (next !== schema) {
  fs.writeFileSync(schemaPath, next);
  console.log(`Prisma datasource provider set to ${provider}`);
} else {
  const match = schema.match(/provider\s*=\s*"(sqlite|postgresql|postgres)"/);
  console.log(`Prisma datasource provider already ${match?.[1] || "unknown"}`);
}
