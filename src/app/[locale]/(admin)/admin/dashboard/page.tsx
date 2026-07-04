import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/auth/get-profile";
import { getAdminDashboardEssentialData } from "@/lib/queries/admin-dashboard";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { toSubscriptionSummary } from "@/lib/queries/subscriptions";
import { CurrentPlanCard } from "@/components/plans/current-plan-card";
import { FeatureGate } from "@/components/plans/feature-gate";
import { DashboardBoxHeader } from "@/components/admin/dashboard/dashboard-box-header";
import { DashboardTodayHero } from "@/components/admin/dashboard/dashboard-today-hero";
import { DashboardQuickActions } from "@/components/admin/dashboard/dashboard-quick-actions";
import { DashboardCorePriorityAlerts } from "@/components/admin/dashboard/dashboard-core-priority-alerts";
import { BirthdayInfoCard } from "@/components/admin/birthday-info-card";
import { DashboardUpcomingClasses } from "@/components/admin/dashboard/dashboard-upcoming-classes";
import { DashboardHeavySection } from "@/components/admin/dashboard/dashboard-heavy-section";
import { DashboardHeavySkeleton } from "@/components/admin/dashboard/dashboard-heavy-skeleton";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireAdmin(locale);
  const t = await getTranslations("admin");
  const td = await getTranslations("adminDashboard");

  const [data, entitlements] = await Promise.all([
    getAdminDashboardEssentialData(undefined),
    getBoxEntitlements(profile.box_id!),
  ]);
  const subscription = toSubscriptionSummary(entitlements);

  const membershipExpired = data.membershipAlerts.vencidas.length;
  const membershipExpiring = data.membershipAlerts.porVencer.length;

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

          <BirthdayInfoCard alerts={data.birthdayAlerts} />

          <DashboardCorePriorityAlerts
            membershipAlerts={data.membershipAlerts}
            lowOccupancyClasses={data.lowOccupancyClasses}
            pendingPayment={data.executive.pendingPayment}
            locale={locale}
            boxName={data.boxName}
            labels={{
              title: td("alerts.title"),
              priorityHigh: td("alerts.priorityHigh"),
              priorityMedium: td("alerts.priorityMedium"),
              expired: t("expired"),
              expiring: t("expiringSoon"),
              lowOccupancy: td("alerts.lowOccupancy"),
              pendingPayment: td("alerts.pendingPayment"),
              emptyPremium: td("alerts.emptyPremium"),
            }}
          />

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

          <Suspense fallback={<DashboardHeavySkeleton />}>
            <DashboardHeavySection
              locale={locale}
              entitlements={entitlements}
            />
          </Suspense>
        </div>
      </FeatureGate>
    </div>
  );
}
