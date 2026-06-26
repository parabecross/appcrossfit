import { APP_CONFIG } from "@/lib/config/app-config";

/** Fecha/hora local de la clase (fecha + hora en zona del dispositivo). */
export function parseClassDateTime(fecha: string, hora: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.slice(0, 5).split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function hasClassEnded(fecha: string, horaFin: string): boolean {
  return new Date() >= parseClassDateTime(fecha, horaFin);
}

export function canBookClass(fecha: string, horaInicio: string): boolean {
  const classStart = parseClassDateTime(fecha, horaInicio);
  const cutoff = new Date(
    classStart.getTime() - APP_CONFIG.RESERVA_CIERRE_MINUTOS * 60 * 1000
  );
  return new Date() < cutoff;
}

export function filterClassesForSocio<T extends { fecha: string; hora_fin: string; estado: string }>(
  clases: T[]
): T[] {
  return clases.filter(
    (c) => c.estado === "programada" && !hasClassEnded(c.fecha, c.hora_fin)
  );
}

export function canCancelReservation(
  claseFecha: string,
  horaInicio: string
): boolean {
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

export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

export function dateStringToLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
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
