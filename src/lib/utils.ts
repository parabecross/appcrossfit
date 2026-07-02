import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import { dateStringToLocalDate } from "@/lib/dates/date-only";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, locale = "es") {
  const value =
    typeof date === "string" ? dateStringToLocalDate(date) : date;
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

export function formatCompactDate(dateStr: string, locale = "es") {
  const d = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    day: "numeric",
    month: "short",
  }).format(d);
}

export function formatShortDay(dateStr: string, locale = "es") {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(d);
}

export function formatWeekdayShort(dateStr: string, locale = "es") {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function formatTime(time: string) {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}
