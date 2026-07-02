import { canUseFeature } from "@/lib/entitlements/permissions";
import type { BoxEntitlements } from "@/lib/entitlements/types";
import { minPlanLabelForFeature } from "@/lib/entitlements/features";
import { DashboardPerformanceTabs } from "@/components/admin/dashboard/dashboard-performance-tabs";
import { DashboardWeeklySummary } from "@/components/admin/dashboard/dashboard-weekly-summary";
import { DashboardAthleteProgress } from "@/components/admin/dashboard/dashboard-athlete-progress";
import type { WeeklySummaryData } from "@/lib/admin/dashboard-helpers";

function LockedTabPanel({
  title,
  planLabel,
}: {
  title: string;
  planLabel: string | null;
}) {
  return (
    <div className="rounded-xl border border-dashed border-orange-500/25 bg-orange-500/[0.03] px-4 py-8 text-center">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-2">
        {planLabel
          ? `Disponible en ${planLabel}.`
          : "Actualiza tu plan para desbloquear."}
      </p>
    </div>
  );
}

export function DashboardPerformanceSection({
  entitlements,
  weeklyData,
  weeklyLabels,
  recentPrs,
  recentSkills,
  topConsistent,
  progressLabels,
  labels,
}: {
  entitlements: BoxEntitlements;
  weeklyData: WeeklySummaryData;
  weeklyLabels: React.ComponentProps<typeof DashboardWeeklySummary>["labels"];
  recentPrs: React.ComponentProps<typeof DashboardAthleteProgress>["recentPrs"];
  recentSkills: React.ComponentProps<typeof DashboardAthleteProgress>["recentSkills"];
  topConsistent: React.ComponentProps<typeof DashboardAthleteProgress>["topConsistent"];
  progressLabels: React.ComponentProps<typeof DashboardAthleteProgress>["labels"];
  labels: {
    title: string;
    tabWeekly: string;
    tabProgress: string;
    viewStats: string;
  };
}) {
  const canWeekly = canUseFeature(entitlements, "resumen_semanal");
  const canProgress = canUseFeature(entitlements, "progreso_atleta");

  if (!canWeekly && !canProgress) return null;

  const weeklyPanel = canWeekly ? (
    <DashboardWeeklySummary
      data={weeklyData}
      labels={weeklyLabels}
      embedded
    />
  ) : (
    <LockedTabPanel
      title={weeklyLabels.title}
      planLabel={minPlanLabelForFeature("resumen_semanal")}
    />
  );

  const progressPanel = canProgress ? (
    <DashboardAthleteProgress
      recentPrs={recentPrs.slice(0, 3)}
      recentSkills={recentSkills.slice(0, 3)}
      topConsistent={topConsistent.slice(0, 3)}
      labels={progressLabels}
      embedded
    />
  ) : (
    <LockedTabPanel
      title={progressLabels.title}
      planLabel={minPlanLabelForFeature("progreso_atleta")}
    />
  );

  return (
    <DashboardPerformanceTabs
      labels={labels}
      canWeekly={canWeekly}
      canProgress={canProgress}
      weeklyPanel={weeklyPanel}
      progressPanel={progressPanel}
    />
  );
}
