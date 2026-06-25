import { APP_CONFIG } from "@/lib/config/app-config";

export function canCancelReservation(
  claseFecha: string,
  horaInicio: string
): boolean {
  const classStart = new Date(`${claseFecha}T${horaInicio}`);
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
  return d.toISOString().split("T")[0];
}
