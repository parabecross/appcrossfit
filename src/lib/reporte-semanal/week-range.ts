import {
  getPreviousWeekRange,
  getWeekRangeInTimezone,
} from "@/lib/admin/dashboard-helpers";
import { formatDisplayDate } from "@/lib/dates/format-display";
import { todayInTimezone } from "@/lib/dates/date-only";
import type { WeekRange } from "./types";

/**
 * Semana actual (lunes–domingo) en la zona horaria del box.
 * Reutiliza getWeekRangeInTimezone del dashboard.
 */
export function getCurrentWeekRange(timeZone: string): WeekRange {
  return getWeekRangeInTimezone(timeZone);
}

/** Semana inmediatamente anterior (lunes–domingo equivalentes). */
export function getPriorWeekRange(timeZone: string): WeekRange {
  return getPreviousWeekRange(timeZone);
}

/**
 * Límites date-only (YYYY-MM-DD) listos para filtrar `clases.fecha`
 * y columnas date-only. El fin inclusive es el domingo (`to`).
 */
export function weekRangeQueryBounds(range: WeekRange): {
  fromInclusive: string;
  toInclusive: string;
} {
  return { fromInclusive: range.from, toInclusive: range.to };
}

/** Etiqueta legible del periodo en español (o locale indicado). */
export function formatWeekRangeForReport(
  range: WeekRange,
  locale = "es"
): string {
  const start = formatDisplayDate(range.from, locale);
  const end = formatDisplayDate(range.to, locale);
  return `${start} – ${end}`;
}

/** Timestamp de generación en la zona del box. */
export function formatGeneratedAt(timeZone: string, locale = "es"): string {
  const now = new Date();
  const formatted = new Intl.DateTimeFormat(
    locale === "es" ? "es-MX" : "en-US",
    {
      timeZone,
      dateStyle: "long",
      timeStyle: "short",
    }
  ).format(now);
  return formatted;
}

export function getTodayInBox(timeZone: string): string {
  return todayInTimezone(timeZone);
}

export { getWeekRangeInTimezone, getPreviousWeekRange };
