import {
  getPreviousWeekRange,
  getWeekRangeInTimezone,
} from "@/lib/admin/dashboard-helpers";
import {
  addDaysToDateString,
  todayInTimezone,
} from "@/lib/dates/date-only";
import {
  formatDisplayDate,
  getWeekStartMonday,
} from "@/lib/dates/format-display";
import type { WeekRange } from "./types";

/** Máximo de semanas hacia atrás que se pueden solicitar (incl. la actual). */
export const MAX_WEEKLY_REPORT_LOOKBACK_WEEKS = 26;

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

/** Semana lunes–domingo a partir de un lunes (YYYY-MM-DD). */
export function weekRangeFromMonday(monday: string): WeekRange {
  return {
    from: monday,
    to: addDaysToDateString(monday, 6),
  };
}

/** Semana previa equivalente a un rango lun–dom. */
export function previousWeekFromRange(week: WeekRange): WeekRange {
  return {
    from: addDaysToDateString(week.from, -7),
    to: addDaysToDateString(week.to, -7),
  };
}

export function isMondayDateOnly(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  return getWeekStartMonday(dateStr) === dateStr;
}

/**
 * Valida y resuelve la semana pedida por el cliente.
 * - Debe ser un lunes YYYY-MM-DD
 * - No puede ser posterior a la semana actual del box
 * - No puede ser más antigua que MAX_WEEKLY_REPORT_LOOKBACK_WEEKS
 */
export function resolveRequestedWeekRange(
  timeZone: string,
  weekStart: string | null | undefined
):
  | { ok: true; week: WeekRange }
  | { ok: false; error: "invalid" | "future" | "too_old" } {
  const current = getCurrentWeekRange(timeZone);

  if (!weekStart) {
    return { ok: true, week: current };
  }

  if (!isMondayDateOnly(weekStart)) {
    return { ok: false, error: "invalid" };
  }

  if (weekStart > current.from) {
    return { ok: false, error: "future" };
  }

  const oldest = addDaysToDateString(
    current.from,
    -(MAX_WEEKLY_REPORT_LOOKBACK_WEEKS - 1) * 7
  );
  if (weekStart < oldest) {
    return { ok: false, error: "too_old" };
  }

  return { ok: true, week: weekRangeFromMonday(weekStart) };
}

export type WeekOption = {
  from: string;
  to: string;
  label: string;
  isCurrent: boolean;
};

/** Opciones de selector: semana actual y hacia atrás. */
export function listRecentWeekOptions(
  timeZone: string,
  locale = "es",
  count = MAX_WEEKLY_REPORT_LOOKBACK_WEEKS
): WeekOption[] {
  const current = getCurrentWeekRange(timeZone);
  const options: WeekOption[] = [];
  const n = Math.min(Math.max(count, 1), MAX_WEEKLY_REPORT_LOOKBACK_WEEKS);

  for (let i = 0; i < n; i++) {
    const from = addDaysToDateString(current.from, -i * 7);
    const week = weekRangeFromMonday(from);
    options.push({
      from: week.from,
      to: week.to,
      label: formatWeekRangeForReport(week, locale),
      isCurrent: i === 0,
    });
  }

  return options;
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
