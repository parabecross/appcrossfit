import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/auth/get-profile";
import { getAdminDashboardData } from "@/lib/queries/admin-dashboard";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { canUseFeature } from "@/lib/entitlements/permissions";
import { FeatureGate } from "@/components/plans/feature-gate";
import { DashboardWeeklySummary } from "@/components/admin/dashboard/dashboard-weekly-summary";
import { AthleteProgressExplorer } from "@/components/admin/rendimiento/athlete-progress-explorer";
import { DashboardRecentActivityCompact } from "@/components/admin/dashboard/dashboard-recent-activity-compact";
import { getBoxAthleteProgressOverview } from "@/lib/queries/athlete-progress-overview";
import { redirect } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function AdminRendimientoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireAdmin(locale);
  const td = await getTranslations("adminDashboard");
  const ts = await getTranslations("stats");

  const [data, entitlements, athletes] = await Promise.all([
    getAdminDashboardData(undefined, locale),
    getBoxEntitlements(profile.box_id!),
    getBoxAthleteProgressOverview(profile.box_id!),
  ]);

  const canWeekly = canUseFeature(entitlements, "resumen_semanal");
  const canProgress = canUseFeature(entitlements, "progreso_atleta");

  if (!canWeekly && !canProgress) {
    redirect({ href: "/admin/dashboard", locale });
  }

  const ws = data.weeklySummary;
  const weeklyDeltaLabel =
    ws.attendanceDelta > 0
      ? td("weekly.deltaUp", { delta: ws.attendanceDelta })
      : ws.attendanceDelta < 0
        ? td("weekly.deltaDown", { delta: Math.abs(ws.attendanceDelta) })
        : td("weekly.deltaSame");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black brand-text">
          {td("performance.pageTitle")}
        </h1>
        <p className="text-muted-foreground mt-2">
          {td("performance.pageSubtitle")}
        </p>
      </div>

      <FeatureGate
        entitlements={entitlements}
        featureKey="resumen_semanal"
        title={td("weekly.title")}
        description={td("weekly.subtitle")}
      >
        <DashboardWeeklySummary
          data={data.weeklySummary}
          labels={{
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
        />
      </FeatureGate>

      <FeatureGate
        entitlements={entitlements}
        featureKey="progreso_atleta"
        title={td("athleteProgress.title")}
        description={td("athleteProgress.empty")}
      >
        <AthleteProgressExplorer
          athletes={athletes}
          labels={{
            title: td("athleteProgress.title"),
            subtitle: td("athleteProgress.explorerSubtitle"),
            searchPlaceholder: td("athleteProgress.searchPlaceholder"),
            filterAll: td("athleteProgress.filterAll"),
            filterActive: td("athleteProgress.filterActive"),
            filterWithPr: td("athleteProgress.filterWithPr"),
            filterWithSkill: td("athleteProgress.filterWithSkill"),
            filterConsistent: td("athleteProgress.filterConsistent"),
            sortLabel: td("athleteProgress.sortLabel"),
            sortName: td("athleteProgress.sortName"),
            sortFrequency: td("athleteProgress.sortFrequency"),
            sortRecentPr: td("athleteProgress.sortRecentPr"),
            sortRecentSkill: td("athleteProgress.sortRecentSkill"),
            columnAthlete: td("athleteProgress.columnAthlete"),
            columnFrequency: td("athleteProgress.columnFrequency"),
            columnLatestPr: td("athleteProgress.columnLatestPr"),
            columnLatestSkill: td("athleteProgress.columnLatestSkill"),
            viewProfile: td("athleteProgress.viewProfile"),
            noResults: td("athleteProgress.noResults"),
            empty: td("athleteProgress.empty"),
            perWeek: ts("frequencyUnit"),
          }}
        />
      </FeatureGate>

      <DashboardRecentActivityCompact
        events={data.recentActivity}
        labels={{
          title: td("today.title"),
          empty: td("today.empty"),
          viewAll: td("today.viewAll"),
          types: {
            reserva: td("today.types.reserva"),
            asistencia: td("today.types.asistencia"),
            pr: td("today.types.pr"),
            skill: td("today.types.skill"),
            membresia: td("today.types.membresia"),
          },
        }}
      />
    </div>
  );
}
