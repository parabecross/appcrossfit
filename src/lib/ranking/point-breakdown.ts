import type { RankingEventType, RankingPointEvent } from "@/types/database";

export type PointBreakdownTotals = {
  attendance: number;
  streak: number;
  wod_position: number;
  evolution: number;
  achievement: number;
};

export type PointBreakdownDetail = {
  type: RankingEventType;
  points: number;
  fecha: string;
  metadata: Record<string, unknown>;
};

const EMPTY_TOTALS: PointBreakdownTotals = {
  attendance: 0,
  streak: 0,
  wod_position: 0,
  evolution: 0,
  achievement: 0,
};

export function summarizePointBreakdown(events: RankingPointEvent[]): {
  totals: PointBreakdownTotals;
  details: PointBreakdownDetail[];
} {
  const totals = { ...EMPTY_TOTALS };
  const details: PointBreakdownDetail[] = [];

  for (const event of events) {
    const key = event.event_type as keyof PointBreakdownTotals;
    if (key in totals) {
      totals[key] += event.points;
    }
    details.push({
      type: event.event_type,
      points: event.points,
      fecha: event.fecha,
      metadata: event.metadata ?? {},
    });
  }

  details.sort((a, b) => {
    const byDate = b.fecha.localeCompare(a.fecha);
    if (byDate !== 0) return byDate;
    return b.points - a.points;
  });

  return { totals, details };
}

export function hasPointBreakdown(totals: PointBreakdownTotals): boolean {
  return Object.values(totals).some((value) => value > 0);
}
