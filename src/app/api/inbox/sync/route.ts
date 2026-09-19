import { NextResponse } from "next/server";
import { importEligibleInbox } from "@/lib/board-import";

export const dynamic = "force-dynamic";

function authorised(request: Request) {
  const secret = process.env.AUTOMATIONS_SECRET?.trim();
  if (!secret) return true;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function handle(request: Request) {
  if (!authorised(request)) {
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
