"use client";

import { useState, type ReactNode } from "react";
import { Link } from "@/i18n/routing";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type TabId = "weekly" | "progress";

export function DashboardPerformanceTabs({
  labels,
  canWeekly,
  canProgress,
  weeklyPanel,
  progressPanel,
}: {
  labels: {
    title: string;
    tabWeekly: string;
    tabProgress: string;
    viewStats: string;
  };
  canWeekly: boolean;
  canProgress: boolean;
  weeklyPanel: ReactNode;
  progressPanel: ReactNode;
}) {
  const defaultTab: TabId = canWeekly ? "weekly" : "progress";
  const [tab, setTab] = useState<TabId>(defaultTab);

  return (
    <section className="rounded-2xl bg-white/[0.02] p-5 md:p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-400/90">
          {labels.title}
        </p>
        <Link
          href="/admin/estadisticas"
          className="inline-flex items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors"
        >
          {labels.viewStats}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {canWeekly && canProgress && (
        <div className="flex gap-1 rounded-xl bg-black/30 p-1 w-fit">
          <button
            type="button"
            onClick={() => setTab("weekly")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              tab === "weekly"
                ? "bg-white/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {labels.tabWeekly}
          </button>
          <button
            type="button"
            onClick={() => setTab("progress")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              tab === "progress"
                ? "bg-white/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {labels.tabProgress}
          </button>
        </div>
      )}

      {tab === "weekly" ? weeklyPanel : progressPanel}
    </section>
  );
}
