import type { WeekRange } from "./types";

/** Nombre de archivo seguro para Content-Disposition. */
export function buildWeeklyReportFilename(week: WeekRange): string {
  return `athron-reporte-semanal-${week.from}-al-${week.to}.pdf`;
}
