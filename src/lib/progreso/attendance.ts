import { addDaysToDateString, todayInTimezone } from "@/lib/dates/date-only";

/**
 * Attendance / streak definitions (socio home + progress).
 *
 * Source of truth: reservas with estado === "asistio", joined to clases.fecha.
 * Confirmada / cancelada / no_asistio do NOT count toward streak or class totals.
 *
 * Streak (racha): consecutive calendar days with ≥1 asistencia ("asistio").
 * - If the athlete trained today, streak includes today and walks backward.
 * - If not today, streak may start from yesterday (still open); otherwise 0.
 * - A gap day resets the streak. Multiple classes same day count as one day.
 *
 * Classes this week: count of asistio rows whose clase.fecha falls in the
 * Monday–Sunday range of the gym timezone (same as getWeekRangeInTimezone).
 *
 * Classes this month: count of asistio rows in the current calendar month
 * up to and including today (gym timezone).
 */

export interface AttendanceRecord {
  fecha: string;
}

export interface AttendanceStats {
  streak: number;
  classesThisWeek: number;
  classesThisMonth: number;
  totalClasses: number;
  attendanceRate: number | null;
  uniqueTrainingDays: number;
}

function monthStartInTimezone(timeZone: string): string {
  const today = todayInTimezone(timeZone);
  return `${today.slice(0, 7)}-01`;
}

export function computeAttendanceStreak(
  dates: string[],
  today: string
): number {
  if (dates.length === 0) return 0;

  const dateSet = new Set(dates);
  const start =
    dateSet.has(today) ? today : addDaysToDateString(today, -1);

  if (!dateSet.has(start)) return 0;

  let streak = 0;
  let cursor = start;
  while (dateSet.has(cursor)) {
    streak += 1;
    cursor = addDaysToDateString(cursor, -1);
  }
  return streak;
}

export function computeClassesInRange(
  records: AttendanceRecord[],
  from: string,
  to: string
): number {
  return records.filter((r) => r.fecha >= from && r.fecha <= to).length;
}

export function computeAttendanceStats(
  records: AttendanceRecord[],
  timeZone: string,
  weekRange?: { from: string; to: string }
): AttendanceStats {
  const today = todayInTimezone(timeZone);
  const monthStart = monthStartInTimezone(timeZone);

  const uniqueDates = Array.from(
    new Set(records.map((r) => r.fecha))
  ).sort((a, b) => b.localeCompare(a));

  const classesThisMonth = computeClassesInRange(records, monthStart, today);
  const classesThisWeek = weekRange
    ? computeClassesInRange(records, weekRange.from, weekRange.to)
    : 0;

  const streak = computeAttendanceStreak(uniqueDates, today);

  return {
    streak,
    classesThisWeek,
    classesThisMonth,
    totalClasses: records.length,
    attendanceRate: null,
    uniqueTrainingDays: uniqueDates.length,
  };
}

export function computeAttendanceRate(
  asistio: number,
  noAsistio: number
): number | null {
  const total = asistio + noAsistio;
  if (total === 0) return null;
  return Math.round((asistio / total) * 100);
}
