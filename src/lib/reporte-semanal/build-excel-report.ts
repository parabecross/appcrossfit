import { getBoxConfig } from "@/lib/box/get-box-config";
import { computeWeeklyReportMetrics } from "./metrics";
import { fetchWeeklyReportData } from "./fetch-data";
import { formatGeneratedAt } from "./week-range";
import {
  formatPeriodLabel,
  resolveReportPeriod,
} from "./period-range";
import { buildExcelWorkbookModel } from "./excel-data";
import {
  buildExecutiveExcelFilename,
  generateExecutiveReportExcel,
} from "./generate-excel";
import { WeeklyReportPeriodError } from "./build-report";

export async function buildExecutiveExcelReport(
  boxId: string,
  from?: string | null,
  to?: string | null
): Promise<{ buffer: Buffer; filename: string }> {
  const box = await getBoxConfig(boxId);
  const resolved = resolveReportPeriod(box.timezone, { from, to });
  if (!resolved.ok) {
    throw new WeeklyReportPeriodError(resolved.error);
  }

  const raw = await fetchWeeklyReportData(boxId, resolved.range);
  const metrics = computeWeeklyReportMetrics({
    timeZone: raw.timezone,
    today: raw.today,
    week: raw.week,
    previousWeek: raw.previousWeek,
    classesThisWeek: raw.classesThisWeek,
    classesPrevWeek: raw.classesPrevWeek,
    reservasThisWeek: raw.reservasThisWeek,
    reservasPrevWeek: raw.reservasPrevWeek,
    attendanceHistory: raw.attendanceHistory,
    socios: raw.socios,
    membershipByUser: raw.membershipByUser,
    prs: raw.prs,
  });

  const model = buildExcelWorkbookModel(raw, metrics, {
    weekLabel: formatPeriodLabel(raw.week, "es"),
    previousWeekLabel: formatPeriodLabel(raw.previousWeek, "es"),
    generatedAtLabel: formatGeneratedAt(raw.timezone, "es"),
  });

  const buffer = await generateExecutiveReportExcel(model);
  const filename = buildExecutiveExcelFilename(raw.week.from, raw.week.to);
  return { buffer, filename };
}
