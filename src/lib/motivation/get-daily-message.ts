import { MOTIVATION_MESSAGES, type MotivationAudience } from "./messages";

export type { MotivationAudience };

/** Día del año (1–366) estable para YYYY-MM-DD (sin zona horaria del runtime). */
export function getDayOfYearFromDateString(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = Date.UTC(y, 0, 0);
  const current = Date.UTC(y, m - 1, d);
  return Math.floor((current - start) / 86_400_000);
}

export function getDailyMotivationMessage(
  audience: MotivationAudience,
  locale: string,
  today: string
): string {
  const lang = locale === "en" ? "en" : "es";
  const messages = MOTIVATION_MESSAGES[lang][audience];
  const index = getDayOfYearFromDateString(today) % messages.length;
  return messages[index];
}
