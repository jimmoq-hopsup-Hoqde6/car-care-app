import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) {
    return new NextResponse("Not found", { status: 404 });
  }

  let photo: { url: string; mimeType: string | null; bytes: Uint8Array | null } | null =
    null;
  try {
    photo = await prisma.photo.findUnique({
      where: { id },
      select: { url: true, mimeType: true, bytes: true },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!photo) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (photo.bytes && photo.bytes.length > 0) {
    return new NextResponse(Buffer.from(photo.bytes), {
      status: 200,
      headers: {
        "Content-Type": photo.mimeType || "image/jpeg",
        "Cache-Control": "private, max-age=86400",
      },
    });
  }

  if (photo.url && !photo.url.startsWith("/api/photos/")) {
    return NextResponse.redirect(new URL(photo.url, _request.url), 302);
  }

  return new NextResponse("Not found", { status: 404 });
}
