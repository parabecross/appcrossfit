import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, locale = "es") {
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function formatCompactDate(dateStr: string, locale = "es") {
  const d = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    day: "numeric",
    month: "short",
  }).format(d);
}

export function formatShortDay(dateStr: string, locale = "es") {
  const d = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

export function formatWeekdayShort(date: Date, locale = "es") {
  return date.toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
    weekday: "short",
    day: "numeric",
  });
}

export function formatTime(time: string) {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}
