import { NextResponse } from "next/server";
import { rateLimitOrNull } from "@/lib/security/rate-limit";
import {
  authorizeWeeklyReportAccess,
  WeeklyReportPeriodError,
} from "@/lib/reporte-semanal";
import { buildExecutiveExcelReport } from "@/lib/reporte-semanal/build-excel-report";
import { EXECUTIVE_EXCEL_CONTENT_TYPE } from "@/lib/reporte-semanal/generate-excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = rateLimitOrNull(request, "admin:reporte-ejecutivo-excel", 10);
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
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const { buffer, filename } = await buildExecutiveExcelReport(
      auth.boxId,
      from,
      to
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": EXECUTIVE_EXCEL_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    if (e instanceof WeeklyReportPeriodError) {
      return NextResponse.json(
        { error: "PERIOD_INVALID", code: e.code },
        { status: 400 }
      );
    }
    console.error("[reporte-ejecutivo-excel]", e);
    return NextResponse.json(
      { error: "No se pudo generar el reporte" },
      { status: 500 }
    );
  }
}
