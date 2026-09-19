import { NextResponse } from "next/server";
import { runAutomations } from "@/lib/automations";

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
  const result = await runAutomations();
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
