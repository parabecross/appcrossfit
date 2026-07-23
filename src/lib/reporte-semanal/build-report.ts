import { getBoxConfig } from "@/lib/box/get-box-config";
import { computeWeeklyReportMetrics } from "./metrics";
import { fetchWeeklyReportData } from "./fetch-data";
import {
  formatGeneratedAt,
  formatWeekRangeForReport,
  getCurrentWeekRange,
  resolveRequestedWeekRange,
} from "./week-range";
import type { WeeklyReportModel, WeekRange } from "./types";

/**
 * Orquesta fetch (solo lectura) + cálculo puro.
 * boxId DEBE provenir de la sesión autenticada.
 * weekStart opcional: lunes YYYY-MM-DD validado en TZ del box.
 */
export async function buildWeeklyReport(
  boxId: string,
  weekStart?: string | null
): Promise<WeeklyReportModel> {
  const box = await getBoxConfig(boxId);
  const resolved = resolveRequestedWeekRange(box.timezone, weekStart);
  if (!resolved.ok) {
    throw new WeeklyReportPeriodError(resolved.error);
  }

  return buildWeeklyReportForRange(boxId, resolved.week);
}

export async function buildWeeklyReportForRange(
  boxId: string,
  week: WeekRange
): Promise<WeeklyReportModel> {
  const raw = await fetchWeeklyReportData(boxId, week);
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

  const hasOperationalData =
    metrics.classesHeld > 0 ||
    metrics.totalReservations > 0 ||
    metrics.totalAttendances > 0 ||
    metrics.uniqueAthletesAttended > 0;

  return {
    boxId: raw.boxId,
    boxName: raw.boxName,
    timezone: raw.timezone,
    logoUrl: raw.logoUrl,
    title: "Reporte semanal",
    week: raw.week,
    previousWeek: raw.previousWeek,
    weekLabel: formatWeekRangeForReport(raw.week, "es"),
    generatedAtLabel: formatGeneratedAt(raw.timezone, "es"),
    metrics,
    hasOperationalData,
  };
}

export class WeeklyReportPeriodError extends Error {
  readonly code: "invalid" | "future" | "too_old";

  constructor(code: "invalid" | "future" | "too_old") {
    super(`Invalid report period: ${code}`);
    this.name = "WeeklyReportPeriodError";
    this.code = code;
  }
}

export { getCurrentWeekRange };
