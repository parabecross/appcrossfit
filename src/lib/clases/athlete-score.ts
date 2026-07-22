import { APP_CONFIG } from "@/lib/config/app-config";
import { daysUntilDateOnly, todayInTimezone } from "@/lib/dates/date-only";
import { hasClassEnded } from "@/lib/clases/helpers";

export type CanAthleteManageClassScoreInput = {
  classDate: string;
  classEndTime: string;
  reservationStatus: string | null | undefined;
  timezone: string;
  /** For tests — defaults to real now. */
  now?: Date;
};

function todayInTimezoneAt(timeZone: string, now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "01";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function hasClassEndedAt(
  fecha: string,
  horaFin: string,
  timeZone: string,
  now: Date
): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const nowY = get("year");
  const nowM = get("month");
  const nowD = get("day");
  const nowH = get("hour");
  const nowMin = get("minute");

  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = horaFin.slice(0, 5).split(":").map(Number);
  const classDay = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  const nowDay = Math.floor(Date.UTC(nowY, nowM - 1, nowD) / 86_400_000);
  const classMinutes = classDay * 24 * 60 + hh * 60 + mm;
  const nowMinutes = nowDay * 24 * 60 + nowH * 60 + nowMin;
  return nowMinutes >= classMinutes;
}

/**
 * Socio may add/edit a class score only when:
 * - they have a reservation that is not `no_asistio` (and not cancelada)
 * - the class has already ended (box timezone)
 * - class calendar date is today, yesterday, or 2 days ago in the box timezone
 */
export function canAthleteManageClassScore(
  input: CanAthleteManageClassScoreInput
): boolean {
  const { classDate, classEndTime, reservationStatus, timezone, now } = input;

  if (
    !reservationStatus ||
    reservationStatus === "no_asistio" ||
    reservationStatus === "cancelada"
  ) {
    return false;
  }

  if (reservationStatus !== "confirmada" && reservationStatus !== "asistio") {
    return false;
  }

  const ended = now
    ? hasClassEndedAt(classDate, classEndTime, timezone, now)
    : hasClassEnded(classDate, classEndTime, timezone);
  if (!ended) return false;

  const today = now
    ? todayInTimezoneAt(timezone, now)
    : todayInTimezone(timezone);
  const daysSince = -daysUntilDateOnly(classDate, today);

  return (
    daysSince >= 0 &&
    daysSince <= APP_CONFIG.ATHLETE_SCORE_EDIT_MAX_AGE_DAYS
  );
}
