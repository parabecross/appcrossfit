import { APP_CONFIG } from "@/lib/config/app-config";

/** YYYY-MM-DD en zona horaria del gym (o la indicada). */
export function todayInTimezone(
  timeZone: string = APP_CONFIG.GYM_TIMEZONE
): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "01";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function dateStringToLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const d = dateStringToLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

/** Días calendario hasta fecha_fin (0 = vence hoy, negativo = ya venció). */
export function daysUntilDateOnly(
  fechaFin: string,
  today: string = todayInTimezone()
): number {
  const [y1, m1, d1] = today.split("-").map(Number);
  const [y2, m2, d2] = fechaFin.split("-").map(Number);
  return Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000
  );
}

/** La membresía venció después del último día de cobertura (fecha_fin). */
export function isDateBeforeToday(
  fechaFin: string,
  today: string = todayInTimezone()
): boolean {
  return daysUntilDateOnly(fechaFin, today) < 0;
}
