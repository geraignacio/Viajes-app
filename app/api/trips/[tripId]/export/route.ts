import { NextResponse, type NextRequest } from "next/server";
import { requireMember } from "@/lib/access";
import { ActionError } from "@/lib/action-result";
import { getTripDashboard } from "@/lib/trips";
import { buildCsv, buildPdf } from "@/lib/export";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const format = req.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "csv";

  try {
    await requireMember(tripId);
  } catch (e) {
    const msg = e instanceof ActionError ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  const data = await getTripDashboard(tripId);
  if (!data) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const slug = data.trip.name.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "viaje";

  if (format === "pdf") {
    return new NextResponse(buildPdf(data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new NextResponse(buildCsv(data), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
