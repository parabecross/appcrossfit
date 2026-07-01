import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth/get-profile";
import { getAdminDashboardData } from "@/lib/queries/admin-dashboard";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { toSubscriptionSummary } from "@/lib/queries/subscriptions";
import { CurrentPlanCard } from "@/components/plans/current-plan-card";
import { FeatureGate } from "@/components/plans/feature-gate";
import { DemandChart, TrendChart } from "@/components/stats/charts";
import { DashboardExecutiveSummary } from "@/components/admin/dashboard/dashboard-executive-summary";
import { DashboardQuickActions } from "@/components/admin/dashboard/dashboard-quick-actions";
import { DashboardBoxStatus } from "@/components/admin/dashboard/dashboard-box-status";
import { DashboardUpcomingClasses } from "@/components/admin/dashboard/dashboard-upcoming-classes";
import { DashboardPriorityAlerts } from "@/components/admin/dashboard/dashboard-priority-alerts";
import { DashboardTodayTimeline } from "@/components/admin/dashboard/dashboard-today-timeline";
import { DashboardAthleteProgress } from "@/components/admin/dashboard/dashboard-athlete-progress";
import { DashboardWeeklySummary } from "@/components/admin/dashboard/dashboard-weekly-summary";
import { DashboardBoxHeader } from "@/components/admin/dashboard/dashboard-box-header";

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

  return (
    <div className="space-y-6 pb-8">
      <DashboardBoxHeader
        boxName={data.boxName}
        today={data.today}
        locale={locale}
        labels={{
          pageTitle: t("dashboard"),
          poweredBy: td("header.poweredBy"),
          platformTagline: td("header.platformTagline"),
        }}
      />

      <section className="space-y-3">
        <p className="text-sm font-bold">{td("quickActions.title")}</p>
        <DashboardQuickActions
          labels={{
            newClass: td("quickActions.newClass"),
            newAthlete: td("quickActions.newAthlete"),
            newCoach: td("quickActions.newCoach"),
            assignMembership: td("quickActions.assignMembership"),
          }}
        />
      </section>

      <CurrentPlanCard
        subscription={subscription}
        labels={{
          currentPlan: td("planCard.currentPlan"),
          promotionalActive: td("planCard.promotionalActive"),
          daysRemaining: td("planCard.daysRemaining"),
          daysRemainingUrgent: td("planCard.daysRemainingUrgent"),
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
        featureKey="dashboard_ejecutivo"
        title={td("executive.title")}
        description={td("executive.title")}
      >
      <DashboardExecutiveSummary
        data={data.executive}
        labels={{
          title: td("executive.title"),
          classesToday: td("executive.classesToday"),
          reservationsToday: td("executive.reservationsToday"),
          attendanceToday: td("executive.attendanceToday"),
          avgOccupancy: td("executive.avgOccupancy"),
          expiringSoon: td("executive.expiringSoon"),
          pendingPayment: td("executive.pendingPayment"),
          recentPrs: td("executive.recentPrs"),
          inactiveAthletes: td("executive.inactiveAthletes"),
        }}
      />
      </FeatureGate>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <FeatureGate
            entitlements={entitlements}
            featureKey="alertas_avanzadas"
            title={td("alerts.title")}
            description={td("alerts.title")}
          >
            <DashboardPriorityAlerts
              membershipAlerts={data.membershipAlerts}
              inactiveAthletesHigh={data.inactiveAthletesHigh}
              athletesWithoutWeekBooking={data.athletesWithoutWeekBooking}
              lowOccupancyClasses={data.lowOccupancyClasses}
              locale={locale}
              boxName={data.boxName}
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
                empty: td("alerts.empty"),
              }}
              formatInactiveDays={(days) =>
                td("alerts.inactiveDays", { days })
              }
            />
          </FeatureGate>
        </div>
        <div className="lg:col-span-2">
          <DashboardBoxStatus
            data={data.boxStatus}
            labels={{
              title: td("boxStatus.title"),
              subtitle: td("boxStatus.subtitle"),
              activeMembers: t("activeMembers"),
              totalMembers: td("boxStatus.totalMembers"),
              expired: t("expiredMembers"),
              expiringSoon: t("expiringSoon"),
              occupancy: td("boxStatus.occupancy"),
              attendanceToday: td("executive.attendanceToday"),
              attendanceRate: td("boxStatus.attendanceRate"),
              noData: td("boxStatus.noData"),
            }}
          />
        </div>
      </div>

      <DashboardUpcomingClasses
        classes={data.todayClasses}
        labels={{
          title: td("upcomingClasses.title"),
          empty: td("upcomingClasses.empty"),
          cupo: td("upcomingClasses.cupo"),
          status: {
            available: td("upcomingClasses.status.available"),
            almost_full: td("upcomingClasses.status.almostFull"),
            full: td("upcomingClasses.status.full"),
          },
        }}
      />

      <DashboardTodayTimeline
        events={data.recentActivity}
        today={data.today}
        locale={locale}
        labels={{
          title: td("today.title"),
          subtitle: td("today.subtitle"),
          empty: td("today.empty"),
          today: td("today.todayLabel"),
          yesterday: td("today.yesterdayLabel"),
          types: {
            reserva: td("today.types.reserva"),
            asistencia: td("today.types.asistencia"),
            pr: td("today.types.pr"),
            skill: td("today.types.skill"),
            membresia: td("today.types.membresia"),
          },
        }}
      />

      {(data.recentPrs.length > 0 || data.recentSkills.length > 0) && (
        <DashboardAthleteProgress
          recentPrs={data.recentPrs}
          recentSkills={data.recentSkills}
          topConsistent={data.topConsistentAthletes}
          labels={{
            title: td("athleteProgress.title"),
            recentPrs: td("athleteProgress.recentPrs"),
            recentSkills: td("athleteProgress.recentSkills"),
            topConsistent: td("athleteProgress.topConsistent"),
            empty: td("athleteProgress.empty"),
            perWeek: ts("frequencyUnit"),
          }}
          exerciseLabel={(key) => tp(`exercises.${key}`)}
          skillLabel={(key) => tp(`skills.${key}`)}
        />
      )}

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
          attendanceVsLast: td("weekly.attendanceVsLast"),
          topClass: td("weekly.topClass"),
          topClassBookings: td("weekly.topClassBookings"),
          prs: td("weekly.prs"),
          goals: td("weekly.goals"),
          memberships: td("weekly.memberships"),
          noTopClass: td("weekly.noTopClass"),
          deltaUp: td("weekly.deltaUp"),
          deltaDown: td("weekly.deltaDown"),
          deltaSame: td("weekly.deltaSame"),
        }}
      />
      </FeatureGate>

      <FeatureGate
        entitlements={entitlements}
        featureKey="estadisticas_avanzadas"
        title={td("charts.sectionTitle")}
        description={td("charts.sectionTitle")}
      >
      <section className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {td("charts.sectionTitle")}
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
            <p className="text-sm font-semibold mb-3">{ts("trend")}</p>
            <TrendChart data={data.charts.trend} locale={locale} />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
            <p className="text-sm font-semibold mb-3">{ts("demand")}</p>
            <DemandChart data={data.charts.demand} />
          </div>
        </div>
      </section>
      </FeatureGate>
    </div>
  );
}
