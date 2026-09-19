import {
  allowedEmails,
  authSecret,
  authUrl,
  defaultAllowlist,
  hasAuthSecret,
  isDemoMode,
  isEmailAllowed,
  isLoginRequired,
} from "../src/lib/env";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const saved = { ...process.env };

function resetEnv(overrides: Record<string, string | undefined>) {
  for (const key of [
    "DEMO_MODE",
    "AUTH_SECRET",
    "NEXTAUTH_SECRET",
    "AUTH_URL",
    "NEXTAUTH_URL",
    "AUTH_ALLOWLIST",
    "ALLOWED_EMAILS",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
  ]) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function main() {
  resetEnv({
    DEMO_MODE: "true",
    AUTH_SECRET: "local-demo-secret",
    GOOGLE_CLIENT_ID: "demo.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "demo-secret",
  });
  assert(isDemoMode(), "DEMO_MODE=true is demo");
  assert(!isLoginRequired(), "Demo stays open without a login gate");

  resetEnv({
    DEMO_MODE: "false",
  });
  delete process.env.AUTH_SECRET;
  delete process.env.NEXTAUTH_SECRET;
  assert(!hasAuthSecret(), "No secret present");
  assert(!isLoginRequired(), "No AUTH_SECRET / NEXTAUTH_SECRET — stay open");

  resetEnv({
    DEMO_MODE: "false",
    NEXTAUTH_SECRET: "hosted-secret",
    GOOGLE_CLIENT_ID: "prod.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "prod-secret",
  });
  assert(hasAuthSecret(), "NEXTAUTH_SECRET counts as the Auth.js secret");
  assert(authSecret() === "hosted-secret", "authSecret reads NEXTAUTH_SECRET");
  assert(isLoginRequired(), "Hosted production-like config requires login");

  resetEnv({
    DEMO_MODE: "false",
    AUTH_SECRET: "auth-js-secret",
    NEXTAUTH_URL: "https://desk.example.com",
  });
  assert(authUrl() === "https://desk.example.com", "NEXTAUTH_URL is accepted");
  assert(isLoginRequired(), "AUTH_SECRET with DEMO=false requires login");

  resetEnv({});
  const defaults = allowedEmails();
  const expected = defaultAllowlist();
  assert(
    expected.includes("info@mobilecarscratchrepairadelaide.com.au"),
    "Default allowlist includes the business inbox",
  );
  assert(
    expected.includes("moogly88@gmail.com"),
    "Default allowlist includes moogly88@gmail.com",
  );
  assert(
    defaults.length === expected.length &&
      expected.every((email) => defaults.includes(email)),
    "Unset AUTH_ALLOWLIST uses Marcel's business accounts",
  );
  assert(
    isEmailAllowed("Info@mobilecarscratchrepairadelaide.com.au"),
    "Allowlist compare is case-insensitive",
  );
  assert(
    isEmailAllowed("  moogly88@gmail.com  "),
    "Allowlist trims whitespace",
  );
  assert(
    !isEmailAllowed("stranger@example.com"),
    "Unknown Google accounts are rejected",
  );
  assert(!isEmailAllowed(null), "Missing email is rejected");

  resetEnv({
    AUTH_ALLOWLIST: "marcel@example.com, extra@mobilecarscratchrepairadelaide.com.au",
  });
  assert(
    allowedEmails().includes("marcel@example.com"),
    "AUTH_ALLOWLIST is configurable",
  );
  assert(
    isEmailAllowed("extra@mobilecarscratchrepairadelaide.com.au"),
    "Comma-separated allowlist entries work",
  );
  assert(
    !isEmailAllowed("moogly88@gmail.com"),
    "Custom allowlist replaces the default list",
  );

  resetEnv({
    ALLOWED_EMAILS: "alt@example.com",
  });
  assert(
    isEmailAllowed("alt@example.com"),
    "ALLOWED_EMAILS is an accepted alias",
  );

  console.log("login:verify ok");
}

try {
  main();
} finally {
  for (const key of Object.keys(process.env)) {
    if (!(key in saved)) delete process.env[key];
  }
  Object.assign(process.env, saved);
}
