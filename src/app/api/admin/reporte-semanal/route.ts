import { NextResponse } from "next/server";
import { rateLimitOrNull } from "@/lib/security/rate-limit";
import {
  authorizeWeeklyReportAccess,
  buildWeeklyReport,
  buildWeeklyReportFilename,
  generateWeeklyReportPdf,
  WeeklyReportPeriodError,
} from "@/lib/reporte-semanal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = rateLimitOrNull(request, "admin:reporte-semanal", 10);
  if (limited) return limited;

  try {
    const auth = await authorizeWeeklyReportAccess();
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const url = new URL(request.url);
    const weekStart = url.searchParams.get("from");

    const report = await buildWeeklyReport(auth.boxId, weekStart);
    const pdf = await generateWeeklyReportPdf(report);
    const filename = buildWeeklyReportFilename(report.week);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    if (e instanceof WeeklyReportPeriodError) {
      return NextResponse.json(
        { error: "PERIOD_INVALID" },
        { status: 400 }
      );
    }
    console.error("[reporte-semanal]", e);
    return NextResponse.json(
      { error: "No se pudo generar el reporte" },
      { status: 500 }
    );
  }
}
