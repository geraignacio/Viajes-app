import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/access";
import { driveFetch, getDriveToken } from "@/lib/google-drive";

export const runtime = "nodejs";

// Miniatura (o vista grande, ?size=1600) de una foto/video del viaje. Los
// archivos son privados en el Drive del organizador, así que se piden con su
// token y se entregan a cualquier integrante del viaje.
export async function GET(req: NextRequest, { params }: { params: Promise<{ tripId: string; photoId: string }> }) {
  const { tripId, photoId } = await params;
  const size = Math.min(2000, Math.max(100, Number(req.nextUrl.searchParams.get("size")) || 400));

  try {
    const { trip } = await requireMember(tripId);
    const photo = await prisma.tripPhoto.findFirst({ where: { id: photoId, tripId } });
    if (!photo || !trip.driveOwnerId) return new NextResponse(null, { status: 404 });

    const token = await getDriveToken(trip.driveOwnerId);
    const { thumbnailLink } = await driveFetch<{ thumbnailLink?: string }>(
      token,
      `/files/${photo.driveFileId}?fields=thumbnailLink`,
    );
    // Los videos recién subidos tardan unos minutos en tener miniatura.
    if (!thumbnailLink) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });

    const img = await fetch(thumbnailLink.replace(/=s\d+$/, `=s${size}`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!img.ok || !img.body) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    return new NextResponse(img.body, {
      headers: {
        "Content-Type": img.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
