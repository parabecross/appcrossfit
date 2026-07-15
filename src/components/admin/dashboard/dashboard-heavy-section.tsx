import { getTranslations } from "next-intl/server";

import { getAdminDashboardHeavyData } from "@/lib/queries/admin-dashboard";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { canUseFeature } from "@/lib/entitlements/permissions";
import { FeatureGate } from "@/components/plans/feature-gate";
import { buildAttentionCases } from "@/lib/retention/attention-cases";
import { DashboardRetentionCases } from "@/components/admin/dashboard/dashboard-attention-center";
import { DashboardPerformanceSection } from "@/components/admin/dashboard/dashboard-performance-section";
import { DashboardChartsSection } from "@/components/admin/dashboard/dashboard-charts-section";

export async function DashboardHeavySection({
  locale,
  boxId,
  boxName,
  today,
}: {
  locale: string;
  boxId: string;
  boxName: string;
  today: string;
}) {
  const [heavy, entitlements, td, ts, tp] = await Promise.all([
    getAdminDashboardHeavyData(undefined, locale),
    getBoxEntitlements(boxId),
    getTranslations("adminDashboard"),
    getTranslations("stats"),
    getTranslations("progress"),
  ]);

  const advancedAlerts = canUseFeature(entitlements, "alertas_avanzadas");
  const ws = heavy.weeklySummary;

  const retentionCases = buildAttentionCases({
    today,
    membershipExpired: [],
    membershipExpiring: [],
    pendingPaymentAthletes: [],
    inactiveAthletes: heavy.inactiveAthletesHigh,
    athletesWithoutWeekBooking: heavy.athletesWithoutWeekBooking,
    limit: 8,
  });

  const membershipStatuses = {
    pendiente_pago: td("attention.membershipStatuses.pendiente_pago"),
    sin_membresia: td("attention.membershipStatuses.sin_membresia"),
    vencida: td("attention.membershipStatuses.vencida"),
    por_vencer: td("attention.membershipStatuses.por_vencer"),
    activo: td("attention.membershipStatuses.activo"),
  };

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
      <DashboardRetentionCases
        cases={retentionCases}
        locale={locale}
        boxName={boxName}
        advancedEnabled={advancedAlerts}
        loadError={heavy.loadError}
        labels={{
          title: td("attention.retentionTitle"),
          levelHigh: td("attention.levelHigh"),
          levelMedium: td("attention.levelMedium"),
          levelLow: td("attention.levelLow"),
          openProfile: td("attention.openProfile"),
          lastAttendance: td("attention.lastAttendance"),
          membership: td("attention.membership"),
          membershipStatuses,
          loadError: td("alerts.loadError"),
          empty: td("alerts.emptyPremium"),
        }}
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
            lowClass: td("weekly.lowClass"),
            lowClassBookingsDetail:
              ws.lowClassName && ws.lowClassBookings >= 0
                ? td("weekly.lowClassBookings", {
                    count: ws.lowClassBookings,
                  })
                : undefined,
            avgOccupancy: td("weekly.avgOccupancy"),
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
