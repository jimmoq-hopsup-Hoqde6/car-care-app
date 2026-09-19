import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { refreshInboxInteractive } from "@/lib/board-import";
import { isEmailAllowed, isLoginRequired } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authorised() {
  if (!isLoginRequired()) return true;
  try {
    const session = await auth();
    return isEmailAllowed(session?.user?.email);
  } catch {
    return false;
  }
}

async function handle(request: Request) {
  if (!(await authorised())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const url = new URL(request.url);
  let force = url.searchParams.get("force") === "1";
  if (request.method === "POST") {
    try {
      const body = (await request.json()) as { force?: boolean };
      if (body?.force) force = true;
    } catch {
      // No JSON body is fine — query string still applies.
    }
  }

  try {
    const result = await refreshInboxInteractive({ force });
    return NextResponse.json({
      threads: result.threads,
      imported: result.imported,
      error: result.error ?? null,
      source: result.source,
      syncedAt: result.syncedAt ?? null,
      skipped: result.skipped ?? false,
    });
  } catch {
    return NextResponse.json(
      {
        threads: [],
        imported: 0,
        error:
          "Gmail could not be loaded. Reconnect Google in Settings if this keeps happening.",
        source: "gmail",
        syncedAt: null,
        skipped: false,
      },
      { status: 200 },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
