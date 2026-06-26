import { MOTIVATION_MESSAGES, type MotivationAudience } from "./messages";

export type { MotivationAudience };

/** Día del año (1–366) estable para la fecha local del dispositivo. */
export function getDayOfYear(date: Date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function getDailyMotivationMessage(
  audience: MotivationAudience,
  locale: string,
  date: Date = new Date()
): string {
  const lang = locale === "en" ? "en" : "es";
  const messages = MOTIVATION_MESSAGES[lang][audience];
  const index = getDayOfYear(date) % messages.length;
  return messages[index];
}
