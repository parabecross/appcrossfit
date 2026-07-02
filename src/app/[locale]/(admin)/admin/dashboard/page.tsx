import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth/get-profile";
import { getAdminDashboardData } from "@/lib/queries/admin-dashboard";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { canUseFeature } from "@/lib/entitlements/permissions";
import { toSubscriptionSummary } from "@/lib/queries/subscriptions";
import { CurrentPlanCard } from "@/components/plans/current-plan-card";
import { FeatureGate } from "@/components/plans/feature-gate";
import { DashboardBoxHeader } from "@/components/admin/dashboard/dashboard-box-header";
import { DashboardTodayHero } from "@/components/admin/dashboard/dashboard-today-hero";
import { DashboardQuickActions } from "@/components/admin/dashboard/dashboard-quick-actions";
import { DashboardPriorityAlerts } from "@/components/admin/dashboard/dashboard-priority-alerts";
import { DashboardUpcomingClasses } from "@/components/admin/dashboard/dashboard-upcoming-classes";
import { DashboardPerformanceSection } from "@/components/admin/dashboard/dashboard-performance-section";
import { DashboardChartsSection } from "@/components/admin/dashboard/dashboard-charts-section";

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireAdmin(locale);
  const t = await getTranslations("admin");
  const td = await getTranslations("adminDashboard");
  const ts = await getTranslations("stats");
  const tp = await getTranslations("progress");

  const [data, entitlements] = await Promise.all([
    getAdminDashboardData(undefined, locale),
    getBoxEntitlements(profile.box_id!),
  ]);
  const subscription = toSubscriptionSummary(entitlements);
  const advancedAlerts = canUseFeature(entitlements, "alertas_avanzadas");

  const membershipExpired = data.membershipAlerts.vencidas.length;
  const membershipExpiring = data.membershipAlerts.porVencer.length;

  const ws = data.weeklySummary;
  const weeklyDeltaLabel =
    ws.attendanceDelta > 0
      ? td("weekly.deltaUp", { delta: ws.attendanceDelta })
      : ws.attendanceDelta < 0
        ? td("weekly.deltaDown", { delta: Math.abs(ws.attendanceDelta) })
        : td("weekly.deltaSame");

  const progressPrs = data.recentPrs.map((p) => ({
    nombre: p.nombre,
    valor: p.valor,
    unidad: p.unidad,
    exerciseDisplay: tp(`exercises.${p.ejercicio}`),
  }));

  const progressSkills = data.recentSkills.map((s) => ({
    nombre: s.nombre,
    skillDisplay: tp(`skills.${s.skill}`),
  }));

  return (
    <div className="space-y-8 pb-10 max-w-6xl">
      <DashboardBoxHeader
        boxName={data.boxName}
        today={data.today}
        locale={locale}
        labels={{
          controlPanel: td("header.controlPanel"),
          poweredBy: td("header.poweredBy"),
          platformTagline: td("header.platformTagline"),
        }}
      />

      <CurrentPlanCard
        subscription={subscription}
        labels={{
          currentPlan: td("planCard.currentPlan"),
          promotionalActive: td("planCard.promotionalActive"),
          formatDaysRemainingUrgent: (days) =>
            td("planCard.daysRemainingUrgent", { days }),
          promotionalEnded: td("planCard.promotionalEnded"),
          fullAccess: td("planCard.fullAccess"),
          perMonth: td("planCard.perMonth"),
          activeAthletes: td("planCard.activeAthletes"),
          limitsStart: td("planCard.limitsStart"),
          limitsPro: td("planCard.limitsPro"),
          limitsElite: td("planCard.limitsElite"),
          daysLabel: td("planCard.daysLabel"),
        }}
      />

      <FeatureGate
        entitlements={entitlements}
        featureKey="dashboard_basico"
        title={t("dashboard")}
        description={td("header.platformTagline")}
      >
        <div className="space-y-8">
          <DashboardTodayHero
            data={{
              reservationsToday: data.executive.reservationsToday,
              attendanceToday: data.executive.attendanceToday,
              classesToday: data.executive.classesToday,
              expiredMemberships: membershipExpired,
              expiringMemberships: membershipExpiring,
            }}
            labels={{
              title: td("todayHero.title"),
              reservationsToday: td("todayHero.reservationsToday"),
              attendanceToday: td("todayHero.attendanceToday"),
              classesToday: td("todayHero.classesToday"),
              membershipsAttention: td("todayHero.membershipsAttention"),
              membershipsHint: td("todayHero.membershipsHint", {
                expired: membershipExpired,
                expiring: membershipExpiring,
              }),
            }}
          />

          <section className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {td("quickActions.title")}
            </p>
            <DashboardQuickActions
              entitlements={entitlements}
              labels={{
                newClass: td("quickActions.newClass"),
                newAthlete: td("quickActions.newAthlete"),
                newCoach: td("quickActions.newCoach"),
                assignMembership: td("quickActions.assignMembership"),
              }}
            />
          </section>

          <DashboardPriorityAlerts
            membershipAlerts={data.membershipAlerts}
            inactiveAthletesHigh={data.inactiveAthletesHigh}
            athletesWithoutWeekBooking={data.athletesWithoutWeekBooking}
            lowOccupancyClasses={data.lowOccupancyClasses}
            pendingPayment={data.executive.pendingPayment}
            locale={locale}
            boxName={data.boxName}
            advancedEnabled={advancedAlerts}
            labels={{
              title: td("alerts.title"),
              priorityHigh: td("alerts.priorityHigh"),
              priorityMedium: td("alerts.priorityMedium"),
              priorityLow: td("alerts.priorityLow"),
              expired: t("expired"),
              expiring: t("expiringSoon"),
              inactive: td("alerts.inactive"),
              noWeekBooking: td("alerts.noWeekBooking"),
              lowOccupancy: td("alerts.lowOccupancy"),
              pendingPayment: td("alerts.pendingPayment"),
              empty: td("alerts.empty"),
              emptyPremium: td("alerts.emptyPremium"),
            }}
            formatInactiveDays={(days) =>
              td("alerts.inactiveDays", { days })
            }
          />

          <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
            <FeatureGate
              entitlements={entitlements}
              featureKey="clases"
              title={td("upcomingClasses.title")}
              description={td("upcomingClasses.empty")}
            >
              <DashboardUpcomingClasses
                classes={data.todayClasses}
                labels={{
                  title: td("upcomingClasses.title"),
                  empty: td("upcomingClasses.empty"),
                  createClass: td("upcomingClasses.createClass"),
                  viewCalendar: td("upcomingClasses.viewCalendar"),
                  cupo: td("upcomingClasses.cupo"),
                  status: {
                    available: td("upcomingClasses.status.available"),
                    almost_full: td("upcomingClasses.status.almostFull"),
                    full: td("upcomingClasses.status.full"),
                  },
                }}
              />
            </FeatureGate>

            {(canUseFeature(entitlements, "resumen_semanal") ||
              canUseFeature(entitlements, "progreso_atleta")) && (
              <DashboardPerformanceSection
                compact
                entitlements={entitlements}
                weeklyData={data.weeklySummary}
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
                topConsistent={data.topConsistentAthletes}
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
          </div>

          <FeatureGate
            entitlements={entitlements}
            featureKey="estadisticas_avanzadas"
            title={td("charts.title")}
            description={td("charts.subtitle")}
          >
            <DashboardChartsSection
              charts={data.charts}
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
      </FeatureGate>
    </div>
  );
}
