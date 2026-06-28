import type { AthleteClassHistoryItem } from "@/lib/queries/athlete-history";

export type HistoryStatusFilter =
  | "all"
  | "asistio"
  | "confirmada"
  | "no_asistio";
export type HistoryPeriodFilter = "month" | "30d" | "90d" | "all";

export type HistoryDayGroup = {
  date: string;
  label: string;
  items: AthleteClassHistoryItem[];
};

export type HistoryMonthGroup = {
  monthKey: string;
  label: string;
  days: HistoryDayGroup[];
  total: number;
  attended: number;
};

function periodStartDate(period: HistoryPeriodFilter): string | null {
  const today = new Date();
  if (period === "all") return null;
  if (period === "month") {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  }
  const days = period === "30d" ? 30 : 90;
  const d = new Date(today);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function filterHistoryItems(
  items: AthleteClassHistoryItem[],
  status: HistoryStatusFilter,
  period: HistoryPeriodFilter
): AthleteClassHistoryItem[] {
  const start = periodStartDate(period);
  return items.filter((item) => {
    if (status !== "all" && item.estado !== status) return false;
    if (start && item.clase.fecha < start) return false;
    return true;
  });
}

export function countByStatus(items: AthleteClassHistoryItem[]) {
  return {
    all: items.length,
    asistio: items.filter((i) => i.estado === "asistio").length,
    confirmada: items.filter((i) => i.estado === "confirmada").length,
    no_asistio: items.filter((i) => i.estado === "no_asistio").length,
  };
}

function monthLabel(monthKey: string, locale: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(d);
}

function dayLabel(dateStr: string, locale: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

export function groupHistoryByMonthDay(
  items: AthleteClassHistoryItem[],
  locale: string
): HistoryMonthGroup[] {
  const byMonth = new Map<string, Map<string, AthleteClassHistoryItem[]>>();

  for (const item of items) {
    const monthKey = item.clase.fecha.slice(0, 7);
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, new Map());
    const byDay = byMonth.get(monthKey)!;
    const day = item.clase.fecha;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(item);
  }

  const months: HistoryMonthGroup[] = [];

  for (const monthKey of Array.from(byMonth.keys()).sort((a, b) =>
    b.localeCompare(a)
  )) {
    const byDay = byMonth.get(monthKey)!;
    const days: HistoryDayGroup[] = [];

    for (const date of Array.from(byDay.keys()).sort((a, b) =>
      b.localeCompare(a)
    )) {
      const dayItems = byDay.get(date)!;
      dayItems.sort((a, b) =>
        b.clase.hora_inicio.localeCompare(a.clase.hora_inicio)
      );
      days.push({ date, label: dayLabel(date, locale), items: dayItems });
    }

    const flat = days.flatMap((d) => d.items);
    months.push({
      monthKey,
      label: monthLabel(monthKey, locale),
      days,
      total: flat.length,
      attended: flat.filter((i) => i.estado === "asistio").length,
    });
  }

  return months;
}
