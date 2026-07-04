import { getTranslations } from "next-intl/server";

import { getAdminDashboardHeavyData } from "@/lib/queries/admin-dashboard";
import { canUseFeature } from "@/lib/entitlements/permissions";
import type { BoxEntitlements } from "@/lib/entitlements/types";
import { FeatureGate } from "@/components/plans/feature-gate";
import { DashboardAdvancedPriorityAlerts } from "@/components/admin/dashboard/dashboard-advanced-priority-alerts";
import { DashboardPerformanceSection } from "@/components/admin/dashboard/dashboard-performance-section";
import { DashboardChartsSection } from "@/components/admin/dashboard/dashboard-charts-section";

export async function DashboardHeavySection({
  locale,
  entitlements,
}: {
  locale: string;
  entitlements: BoxEntitlements;
}) {
  const [heavy, td, ts, tp] = await Promise.all([
    getAdminDashboardHeavyData(undefined, locale),
    getTranslations("adminDashboard"),
    getTranslations("stats"),
    getTranslations("progress"),
  ]);

  const advancedAlerts = canUseFeature(entitlements, "alertas_avanzadas");
  const ws = heavy.weeklySummary;

  const weeklyDeltaLabel =
    ws.attendanceDelta > 0
      ? td("weekly.deltaUp", { delta: ws.attendanceDelta })
      : ws.attendanceDelta < 0
        ? td("weekly.deltaDown", { delta: Math.abs(ws.attendanceDelta) })
        : td("weekly.deltaSame");

  const progressPrs = heavy.recentPrs.map((p) => ({
    nombre: p.nombre,
    valor: p.valor,
    unidad: p.unidad,
    exerciseDisplay: tp(`exercises.${p.ejercicio}`),
  }));

  const progressSkills = heavy.recentSkills.map((s) => ({
    nombre: s.nombre,
    skillDisplay: tp(`skills.${s.skill}`),
  }));

  const showPerformance =
    canUseFeature(entitlements, "resumen_semanal") ||
    canUseFeature(entitlements, "progreso_atleta");

  return (
    <div className="space-y-8">
      <DashboardAdvancedPriorityAlerts
        inactiveAthletesHigh={heavy.inactiveAthletesHigh}
        athletesWithoutWeekBooking={heavy.athletesWithoutWeekBooking}
        advancedEnabled={advancedAlerts}
        loadError={heavy.loadError}
        labels={{
          priorityMedium: td("alerts.priorityMedium"),
          priorityLow: td("alerts.priorityLow"),
          inactive: td("alerts.inactive"),
          noWeekBooking: td("alerts.noWeekBooking"),
          loadError: td("alerts.loadError"),
        }}
        formatInactiveDays={(days) => td("alerts.inactiveDays", { days })}
      />

      {showPerformance && (
        <DashboardPerformanceSection
            compact
            entitlements={entitlements}
            weeklyData={heavy.weeklySummary}
            weeklyLabels={{
              title: td("weekly.title"),
              subtitle: td("weekly.subtitle"),
              attendance: td("weekly.attendance"),
              attendanceDetail: `${td("weekly.attendanceVsLast", { last: ws.attendanceLastWeek })} · ${weeklyDeltaLabel}`,
              topClass: td("weekly.topClass"),
              topClassBookingsDetail:
                ws.topClassBookings > 0
                  ? td("weekly.topClassBookings", {
                      count: ws.topClassBookings,
                    })
                  : undefined,
              prs: td("weekly.prs"),
              goals: td("weekly.goals"),
              memberships: td("weekly.memberships"),
              noTopClass: td("weekly.noTopClass"),
            }}
            recentPrs={progressPrs}
            recentSkills={progressSkills}
            topConsistent={heavy.topConsistentAthletes}
            progressLabels={{
              title: td("athleteProgress.title"),
              recentPrs: td("athleteProgress.recentPrs"),
              recentSkills: td("athleteProgress.recentSkills"),
              topConsistent: td("athleteProgress.topConsistent"),
              empty: td("athleteProgress.empty"),
              perWeek: ts("frequencyUnit"),
            }}
            labels={{
              title: td("performance.title"),
              tabWeekly: td("performance.tabWeekly"),
              tabProgress: td("performance.tabProgress"),
              viewStats: td("performance.viewStats"),
            }}
          />
      )}

      <FeatureGate
        entitlements={entitlements}
        featureKey="estadisticas_avanzadas"
        title={td("charts.title")}
        description={td("charts.subtitle")}
      >
        <DashboardChartsSection
          charts={heavy.charts}
          locale={locale}
          labels={{
            title: td("charts.title"),
            subtitle: td("charts.subtitle"),
            viewStats: td("charts.viewStats"),
            trend: ts("trend"),
            demand: ts("demand"),
          }}
        />
      </FeatureGate>
    </div>
  );
}
