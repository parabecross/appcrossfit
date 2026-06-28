import { dateStringToLocalDate, toDateString } from "@/lib/dates/date-only";

function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function cleanToken(value: string): string {
  return capitalizeFirst(value.replace(/\.$/, "").trim());
}

export function formatDisplayDate(date: string | Date, locale = "es"): string {
  const value =
    typeof date === "string" ? dateStringToLocalDate(date) : date;
  const formatted = new Intl.DateTimeFormat(
    locale === "es" ? "es-MX" : "en-US",
    { day: "numeric", month: "long", year: "numeric" }
  ).format(value);
  return capitalizeFirst(formatted);
}

export function formatRankingDayParts(dateStr: string, locale = "es") {
  const value = dateStringToLocalDate(dateStr);
  const loc = locale === "es" ? "es-MX" : "en-US";
  const weekday = new Intl.DateTimeFormat(loc, { weekday: "short" }).format(
    value
  );
  const month = new Intl.DateTimeFormat(loc, { month: "short" }).format(value);

  return {
    day: value.getDate(),
    weekday: cleanToken(weekday),
    month: cleanToken(month),
  };
}

export function getWeekStartMonday(dateStr: string): string {
  const value = dateStringToLocalDate(dateStr);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  return toDateString(value);
}

export function formatWeekRangeLabel(
  startStr: string,
  endStr: string,
  locale: string
): string {
  const start = dateStringToLocalDate(startStr);
  const end = dateStringToLocalDate(endStr);
  const loc = locale === "es" ? "es-MX" : "en-US";

  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = cleanToken(
    new Intl.DateTimeFormat(loc, { month: "short" }).format(start)
  );
  const endMonth = cleanToken(
    new Intl.DateTimeFormat(loc, { month: "short" }).format(end)
  );

  if (startStr === endStr) {
    return `${startDay} ${startMonth}`;
  }

  if (startMonth === endMonth) {
    return `${startDay} – ${endDay} ${endMonth}`;
  }

  return `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
}
