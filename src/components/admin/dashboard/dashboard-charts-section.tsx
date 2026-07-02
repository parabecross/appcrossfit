import { Link } from "@/i18n/routing";
import { ArrowRight } from "lucide-react";
import { DashboardChartsPanel } from "@/components/admin/dashboard/dashboard-charts-panel";
import type { computeDemandStats, computeTrendStats } from "@/lib/queries/stats";

export function DashboardChartsSection({
  charts,
  locale,
  labels,
}: {
  charts: {
    trend: ReturnType<typeof computeTrendStats>;
    demand: ReturnType<typeof computeDemandStats>;
  };
  locale: string;
  labels: {
    title: string;
    subtitle: string;
    viewStats: string;
    trend: string;
    demand: string;
  };
}) {
  return (
    <section className="rounded-2xl bg-white/[0.02] p-5 md:p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-400/90">
            {labels.title}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{labels.subtitle}</p>
        </div>
        <Link
          href="/admin/estadisticas"
          className="inline-flex items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors shrink-0"
        >
          {labels.viewStats}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <DashboardChartsPanel
        trend={charts.trend}
        demand={charts.demand}
        locale={locale}
        labels={{ trend: labels.trend, demand: labels.demand }}
      />
    </section>
  );
}
