import {
  addDaysToDateString,
  todayInTimezone,
} from "@/lib/dates/date-only";
import { formatDisplayDate } from "@/lib/dates/format-display";
import {
  getCurrentWeekRange,
  resolveRequestedWeekRange,
} from "./week-range";
import type { WeekRange } from "./types";

/** Máximo de días inclusivos en un reporte ejecutivo. */
export const MAX_REPORT_RANGE_DAYS = 31;

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ReportPeriodErrorCode =
  | "invalid"
  | "future"
  | "inverted"
  | "too_long"
  | "too_old";

export function isDateOnlyString(value: string): boolean {
  if (!DATE_ONLY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Días inclusivos entre from y to (ambos date-only). */
export function inclusiveDayCount(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const diff = Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000
  );
  return diff + 1;
}

/**
 * Periodo inmediatamente anterior con la misma cantidad de días inclusivos.
 * Ej: 10–20 jul (11 días) → 29 jun–9 jul.
 */
export function previousPeriodOfEqualDuration(range: WeekRange): WeekRange {
  const days = inclusiveDayCount(range.from, range.to);
  const previousTo = addDaysToDateString(range.from, -1);
  const previousFrom = addDaysToDateString(previousTo, -(days - 1));
  return { from: previousFrom, to: previousTo };
}

export function formatPeriodLabel(range: WeekRange, locale = "es"): string {
  if (range.from === range.to) {
    return formatDisplayDate(range.from, locale);
  }
  return `${formatDisplayDate(range.from, locale)} – ${formatDisplayDate(range.to, locale)}`;
}

/**
 * Valida un rango libre from/to en la timezone del box.
 * - date-only válido
 * - from <= to
 * - ningún extremo > today (box TZ)
 * - máximo MAX_REPORT_RANGE_DAYS inclusivos
 */
export function validateReportDateRange(
  timeZone: string,
  from: string,
  to: string
):
  | { ok: true; range: WeekRange }
  | { ok: false; error: ReportPeriodErrorCode } {
  if (!isDateOnlyString(from) || !isDateOnlyString(to)) {
    return { ok: false, error: "invalid" };
  }

  if (from > to) {
    return { ok: false, error: "inverted" };
  }

  const today = todayInTimezone(timeZone);
  if (from > today || to > today) {
    return { ok: false, error: "future" };
  }

  const days = inclusiveDayCount(from, to);
  if (days > MAX_REPORT_RANGE_DAYS) {
    return { ok: false, error: "too_long" };
  }

  if (days < 1) {
    return { ok: false, error: "invalid" };
  }

  return { ok: true, range: { from, to } };
}

/**
 * Resuelve el periodo del reporte.
 * - from+to → rango personalizado
 * - solo from (legacy) → semana lun–dom si from es lunes
 * - sin params → semana actual
 */
export function resolveReportPeriod(
  timeZone: string,
  params: { from?: string | null; to?: string | null }
):
  | { ok: true; range: WeekRange }
  | { ok: false; error: ReportPeriodErrorCode } {
  const from = params.from?.trim() || null;
  const to = params.to?.trim() || null;

  if (from && to) {
    return validateReportDateRange(timeZone, from, to);
  }

  if (from && !to) {
    const legacy = resolveRequestedWeekRange(timeZone, from);
    if (!legacy.ok) return legacy;
    return { ok: true, range: legacy.week };
  }

  if (!from && !to) {
    return { ok: true, range: getCurrentWeekRange(timeZone) };
  }

  return { ok: false, error: "invalid" };
}

/** Helper puro para UI: ¿el rango es válido para habilitar descarga? */
export function isReportRangeSelectable(
  timeZone: string,
  from: string,
  to: string
): boolean {
  return validateReportDateRange(timeZone, from, to).ok;
}
