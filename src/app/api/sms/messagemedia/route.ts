import { NextResponse } from "next/server";
import { handleSmsWebhookPayload } from "@/lib/sms/inbound";

async function readPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    return Object.fromEntries(form.entries());
  }
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  const payload = await readPayload(request);
  const result = await handleSmsWebhookPayload(payload);
  return NextResponse.json({ ok: true, ...result });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: "messagemedia",
    hint: "POST inbound SMS or delivery callbacks here.",
  });
}
