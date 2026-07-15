/**
 * Ranking month keys are YYYY-MM in the box timezone calendar.
 * Never format with `new Date(`${monthKey}-01`)` — that is UTC midnight and
 * shifts to the previous month in Americas timezones.
 */

export function isValidMonthKey(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Safe label: "julio de 2026" / "July 2026" using local calendar parts. */
export function formatMonthKeyLabel(monthKey: string, locale: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  const d = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Capitalize first letter for selector display. */
export function formatMonthKeyLabelTitle(
  monthKey: string,
  locale: string
): string {
  const label = formatMonthKeyLabel(monthKey, locale);
  if (!label) return label;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function currentMonthKeyInTimezone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}
