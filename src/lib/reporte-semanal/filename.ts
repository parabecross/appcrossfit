import type { WeekRange } from "./types";

/** Nombre de archivo seguro para Content-Disposition. */
export function buildWeeklyReportFilename(range: WeekRange): string {
  return `athron-reporte-ejecutivo-${range.from}-al-${range.to}.pdf`;
}

/** @deprecated alias — mismo contrato que buildWeeklyReportFilename */
export const buildExecutiveReportFilename = buildWeeklyReportFilename;
