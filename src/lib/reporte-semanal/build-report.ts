import { computeWeeklyReportMetrics } from "./metrics";
import { fetchWeeklyReportData } from "./fetch-data";
import {
  formatGeneratedAt,
  formatWeekRangeForReport,
} from "./week-range";
import type { WeeklyReportModel } from "./types";

/**
 * Orquesta fetch (solo lectura) + cálculo puro.
 * boxId DEBE provenir de la sesión autenticada.
 */
export async function buildWeeklyReport(
  boxId: string
): Promise<WeeklyReportModel> {
  const raw = await fetchWeeklyReportData(boxId);
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
