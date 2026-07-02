"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";
import { ChevronDown } from "lucide-react";
import { DemandChart, TrendChart } from "@/components/stats/charts";
import type { computeDemandStats, computeTrendStats } from "@/lib/queries/stats";
import { cn } from "@/lib/utils";

export function DashboardStatsPreview({
  trend,
  demand,
  locale,
  labels,
}: {
  trend: ReturnType<typeof computeTrendStats>;
  demand: ReturnType<typeof computeDemandStats>;
  locale: string;
  labels: {
    title: string;
    trend: string;
    demand: string;
    viewExecutive: string;
    expand: string;
    collapse: string;
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {labels.title}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {open ? labels.collapse : labels.expand}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
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
          <Link
            href="/admin/estadisticas"
            className="inline-flex text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors"
          >
            {labels.viewExecutive} →
          </Link>
        </div>
      )}
    </section>
  );
}
