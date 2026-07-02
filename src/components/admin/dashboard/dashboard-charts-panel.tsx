"use client";

import { DemandChart, TrendChart } from "@/components/stats/charts";
import type { computeDemandStats, computeTrendStats } from "@/lib/queries/stats";

export function DashboardChartsPanel({
  trend,
  demand,
  locale,
  labels,
}: {
  trend: ReturnType<typeof computeTrendStats>;
  demand: ReturnType<typeof computeDemandStats>;
  locale: string;
  labels: {
    trend: string;
    demand: string;
  };
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl bg-black/20 p-4">
        <p className="text-sm font-semibold mb-3">{labels.trend}</p>
        <TrendChart data={trend} locale={locale} />
      </div>
      <div className="rounded-xl bg-black/20 p-4">
        <p className="text-sm font-semibold mb-3">{labels.demand}</p>
        <DemandChart data={demand} />
      </div>
    </div>
  );
}
