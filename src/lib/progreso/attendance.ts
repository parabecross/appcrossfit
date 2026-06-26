import { addDaysToDateString, todayInTimezone } from "@/lib/dates/date-only";

export interface AttendanceRecord {
  fecha: string;
}

export interface AttendanceStats {
  streak: number;
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

export function computeAttendanceStats(
  records: AttendanceRecord[],
  timeZone: string
): AttendanceStats {
  const today = todayInTimezone(timeZone);
  const monthStart = monthStartInTimezone(timeZone);

  const uniqueDates = Array.from(
    new Set(records.map((r) => r.fecha))
  ).sort((a, b) => b.localeCompare(a));

  const classesThisMonth = records.filter(
    (r) => r.fecha >= monthStart && r.fecha <= today
  ).length;

  const streak = computeAttendanceStreak(uniqueDates, today);

  return {
    streak,
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
