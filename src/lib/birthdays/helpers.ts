import { addDaysToDateString } from "@/lib/dates/date-only";

export type BirthdayWindow = "tomorrow" | "today" | "yesterday";

function monthDayFromDateOnly(dateStr: string): string | null {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const [, month, day] = parts;
  if (!month || !day) return null;
  return `${month}-${day}`;
}

export function getBirthdayWindow(
  fechaNacimiento: string | null | undefined,
  today: string
): BirthdayWindow | null {
  if (!fechaNacimiento?.trim()) return null;

  const birthMonthDay = monthDayFromDateOnly(fechaNacimiento.trim());
  if (!birthMonthDay) return null;

  const todayMonthDay = monthDayFromDateOnly(today);
  const tomorrowMonthDay = monthDayFromDateOnly(addDaysToDateString(today, 1));
  const yesterdayMonthDay = monthDayFromDateOnly(addDaysToDateString(today, -1));

  if (!todayMonthDay || !tomorrowMonthDay || !yesterdayMonthDay) return null;

  if (birthMonthDay === todayMonthDay) return "today";
  if (birthMonthDay === tomorrowMonthDay) return "tomorrow";
  if (birthMonthDay === yesterdayMonthDay) return "yesterday";

  return null;
}

export function buildBirthdayGreeting(
  nombreCompleto: string,
  locale: string,
  age: number | null
): string {
  void age;
  const firstName = nombreCompleto.trim().split(/\s+/)[0] || nombreCompleto.trim();

  if (locale.startsWith("en")) {
    return `Happy birthday, ${firstName}! 🎉💪 The whole box wishes you a year full of new PRs, grit, and memorable workouts. Today is also a great day to book your class!`;
  }

  return `¡Feliz cumpleaños, ${firstName}! 🎉💪 Todo el box te desea un año lleno de nuevos PRs, mucha garra y entrenamientos memorables. ¡Hoy también es un gran día para reservar tu clase!`;
}
