import { NextResponse } from "next/server";
import { importEligibleInbox } from "@/lib/board-import";
import { cronAuthorised } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request) {
  if (!cronAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  try {
    const result = await importEligibleInbox();
    return NextResponse.json({
      imported: result.imported,
      error: result.error ?? null,
      source: result.source,
    });
  } catch {
    return NextResponse.json(
      {
        imported: 0,
        error:
          "Gmail could not be loaded. Reconnect Google in Settings if this keeps happening.",
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
