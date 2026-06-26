import { APP_CONFIG } from "@/lib/config/app-config";
import {
  addDaysToDateString,
  todayInTimezone,
  toDateString,
} from "@/lib/dates/date-only";

export {
  addDaysToDateString,
  dateStringToLocalDate,
  todayInTimezone,
  toDateString,
} from "@/lib/dates/date-only";

function getGymWallClock(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  return {
    y: get("year"),
    m: get("month"),
    d: get("day"),
    h: get("hour"),
    min: get("minute"),
  };
}

function wallClockToMinutes(fecha: string, hora: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.slice(0, 5).split(":").map(Number);
  const dayNum = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return dayNum * 24 * 60 + hh * 60 + mm;
}

function nowWallClockMinutes(timeZone: string): number {
  const now = getGymWallClock(timeZone);
  const dayNum = Math.floor(Date.UTC(now.y, now.m - 1, now.d) / 86_400_000);
  return dayNum * 24 * 60 + now.h * 60 + now.min;
}

/** Fecha/hora local de la clase (fecha + hora en zona del dispositivo). */
export function parseClassDateTime(fecha: string, hora: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.slice(0, 5).split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function hasClassEnded(
  fecha: string,
  horaFin: string,
  timeZone?: string
): boolean {
  if (timeZone) {
    return nowWallClockMinutes(timeZone) >= wallClockToMinutes(fecha, horaFin);
  }
  return new Date() >= parseClassDateTime(fecha, horaFin);
}

export function normalizeClassTime(hora: string): string {
  return hora.slice(0, 5);
}

/** Dos franjas horarias se solapan (mismo día). */
export function classTimesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const a0 = normalizeClassTime(startA);
  const a1 = normalizeClassTime(endA);
  const b0 = normalizeClassTime(startB);
  const b1 = normalizeClassTime(endB);
  return a0 < b1 && b0 < a1;
}

export interface ClaseScheduleSlot {
  id?: string;
  nombre?: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado?: string;
}

export function findOverlappingClasses(
  clases: ClaseScheduleSlot[],
  candidate: ClaseScheduleSlot,
  excludeId?: string
): ClaseScheduleSlot[] {
  return clases.filter(
    (c) =>
      c.estado !== "cancelada" &&
      c.fecha === candidate.fecha &&
      c.id !== excludeId &&
      classTimesOverlap(
        candidate.hora_inicio,
        candidate.hora_fin,
        c.hora_inicio,
        c.hora_fin
      )
  );
}

export function canBookClass(
  fecha: string,
  horaInicio: string,
  timeZone?: string
): boolean {
  if (timeZone) {
    const classStart = wallClockToMinutes(fecha, horaInicio);
    const now = nowWallClockMinutes(timeZone);
    return now < classStart - APP_CONFIG.RESERVA_CIERRE_MINUTOS;
  }

  const classStart = parseClassDateTime(fecha, horaInicio);
  const cutoff = new Date(
    classStart.getTime() - APP_CONFIG.RESERVA_CIERRE_MINUTOS * 60 * 1000
  );
  return new Date() < cutoff;
}

export function filterClassesForSocio<T extends { fecha: string; hora_fin: string; estado: string }>(
  clases: T[],
  timeZone?: string
): T[] {
  return clases.filter(
    (c) =>
      c.estado === "programada" && !hasClassEnded(c.fecha, c.hora_fin, timeZone)
  );
}

export function canCancelReservation(
  claseFecha: string,
  horaInicio: string,
  timeZone?: string
): boolean {
  if (timeZone) {
    const classStart = wallClockToMinutes(claseFecha, horaInicio);
    const now = nowWallClockMinutes(timeZone);
    return now < classStart - APP_CONFIG.CANCELACION_HORAS * 60;
  }

  const classStart = parseClassDateTime(claseFecha, horaInicio);
  const cutoff = new Date(
    classStart.getTime() - APP_CONFIG.CANCELACION_HORAS * 60 * 60 * 1000
  );
  return new Date() < cutoff;
}

export function getWeekDates(baseDate: Date = new Date()): Date[] {
  const day = baseDate.getDay();
  const monday = new Date(baseDate);
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(baseDate.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/** Rango de fechas para que el socio vea clases futuras (no solo la semana calendario). */
export function getSocioClasesDateRange(timeZone?: string): {
  from: string;
  to: string;
} {
  const from = timeZone ? todayInTimezone(timeZone) : toDateString(new Date());
  const to = addDaysToDateString(from, APP_CONFIG.SOCIO_CLASES_HORIZON_DIAS);
  return { from, to };
}

export function getClassDates(
  clases: { fecha: string; estado: string }[]
): string[] {
  return Array.from(
    new Set(
      clases.filter((c) => c.estado === "programada").map((c) => c.fecha)
    )
  ).sort();
}

/** @deprecated Use getClassDates — only days in the current calendar week */
export function getWeekDaysWithClasses(
  clases: { fecha: string; estado: string }[],
  baseDate: Date = new Date()
): Date[] {
  const week = getWeekDates(baseDate);
  const datesWithClasses = new Set(getClassDates(clases));
  return week.filter((d) => datesWithClasses.has(toDateString(d)));
}
