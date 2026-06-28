import {
  formatWeekRangeLabel,
  getWeekStartMonday,
} from "@/lib/dates/format-display";
import type { DailyHistoryDay } from "@/lib/ranking/aggregate";

export type DailyHistoryWeekGroup = {
  weekKey: string;
  label: string;
  days: DailyHistoryDay[];
  totalPoints: number;
  totalClasses: number;
};

export function groupDailyHistoryByWeek(
  days: DailyHistoryDay[],
  locale: string
): DailyHistoryWeekGroup[] {
  const byWeek = new Map<string, DailyHistoryDay[]>();

  for (const day of days) {
    const weekKey = getWeekStartMonday(day.fecha);
    const bucket = byWeek.get(weekKey);
    if (bucket) bucket.push(day);
    else byWeek.set(weekKey, [day]);
  }

  return Array.from(byWeek.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([weekKey, weekDays]) => {
      const sortedDays = [...weekDays].sort((a, b) =>
        b.fecha.localeCompare(a.fecha)
      );
      const earliestDay =
        sortedDays[sortedDays.length - 1]?.fecha ?? weekKey;
      const latestDay = sortedDays[0]?.fecha ?? weekKey;

      return {
        weekKey,
        label: formatWeekRangeLabel(earliestDay, latestDay, locale),
        days: sortedDays,
        totalPoints: sortedDays.reduce((sum, day) => sum + day.total_points, 0),
        totalClasses: sortedDays.reduce(
          (sum, day) => sum + day.classes.length,
          0
        ),
      };
    });
}
