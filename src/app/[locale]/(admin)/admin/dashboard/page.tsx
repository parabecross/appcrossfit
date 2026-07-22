import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { getAdminDashboardEssentialData } from "@/lib/queries/admin-dashboard";
import { loadBoxSeguimientosSnapshot } from "@/lib/queries/seguimientos";
import { buildAttentionCases, DASHBOARD_ATTENTION_PREVIEW_LIMIT } from "@/lib/retention/attention-cases";
import { DashboardBoxHeader } from "@/components/admin/dashboard/dashboard-box-header";
import { DashboardTodayHero } from "@/components/admin/dashboard/dashboard-today-hero";
import { DashboardQuickActions } from "@/components/admin/dashboard/dashboard-quick-actions";
import { DashboardAttentionCenter } from "@/components/admin/dashboard/dashboard-attention-center";
import { DashboardUpcomingClasses } from "@/components/admin/dashboard/dashboard-upcoming-classes";
import { DashboardHeavySection } from "@/components/admin/dashboard/dashboard-heavy-section";
import { DashboardHeavySkeleton } from "@/components/admin/dashboard/dashboard-heavy-skeleton";
import { DashboardPlanCardSection } from "@/components/admin/dashboard/dashboard-plan-card-section";
import { DashboardPlanCardSkeleton } from "@/components/admin/dashboard/dashboard-plan-card-skeleton";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireAdmin(locale);
  const td = await getTranslations("adminDashboard");

  const data = await getAdminDashboardEssentialData(undefined);

  const membershipExpired = data.membershipAlerts.vencidas.length;
  const membershipExpiring = data.membershipAlerts.porVencer.length;

  const { cases: essentialCases, total: essentialCasesTotal } =
    buildAttentionCases({
      today: data.today,
      membershipExpired: data.membershipAlerts.vencidas,
      membershipExpiring: data.membershipAlerts.porVencer,
      pendingPaymentAthletes: data.pendingPaymentAthletes,
      inactiveAthletes: [],
      athletesWithoutWeekBooking: [],
      limit: DASHBOARD_ATTENTION_PREVIEW_LIMIT,
    });

  const supabase = await createClient();
  const { data: socioRows } = await supabase
    .from("profiles")
    .select("id")
    .eq("box_id", profile.box_id!)
    .eq("rol", "socio");
  const socioIds = (socioRows ?? []).map((s) => s.id);
  const seguimientos = await loadBoxSeguimientosSnapshot(
    profile.box_id!,
    socioIds
  );
  const neverContactedAttention = essentialCases.filter(
    (c) =>
      seguimientos.byAthlete.get(c.profileId)?.neverContacted ?? true
  ).length;

  const planCardLabels = {
    currentPlan: td("planCard.currentPlan"),
    promotionalActive: td("planCard.promotionalActive"),
    formatDaysRemainingUrgent: (days: number) =>
      td("planCard.daysRemainingUrgent", { days }),
    promotionalEnded: td("planCard.promotionalEnded"),
    fullAccess: td("planCard.fullAccess"),
    perMonth: td("planCard.perMonth"),
    activeAthletes: td("planCard.activeAthletes"),
    limitsStart: td("planCard.limitsStart"),
    limitsPro: td("planCard.limitsPro"),
    limitsElite: td("planCard.limitsElite"),
    daysLabel: td("planCard.daysLabel"),
  };

  const membershipStatuses = {
    pendiente_pago: td("attention.membershipStatuses.pendiente_pago"),
    sin_membresia: td("attention.membershipStatuses.sin_membresia"),
    vencida: td("attention.membershipStatuses.vencida"),
    por_vencer: td("attention.membershipStatuses.por_vencer"),
    activo: td("attention.membershipStatuses.activo"),
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-10 max-w-6xl">
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

      <Suspense fallback={<DashboardPlanCardSkeleton />}>
        <DashboardPlanCardSection
          boxId={profile.box_id!}
          labels={planCardLabels}
        />
      </Suspense>

      <DashboardTodayHero
        data={{
          reservationsToday: data.executive.reservationsToday,
          attendanceToday: data.executive.attendanceToday,
          classesToday: data.executive.classesToday,
          avgOccupancyToday: data.executive.avgOccupancyToday,
          availableSpotsToday: data.executive.availableSpotsToday,
          expiredMemberships: membershipExpired,
          expiringMemberships: membershipExpiring,
          pendingPayment: data.executive.pendingPayment,
        }}
        labels={{
          title: td("todayHero.title"),
          reservationsToday: td("todayHero.reservationsToday"),
          attendanceToday: td("todayHero.attendanceToday"),
          classesToday: td("todayHero.classesToday"),
          avgOccupancy: td("todayHero.avgOccupancy"),
          availableSpots: td("todayHero.availableSpots"),
          membershipsAttention: td("todayHero.membershipsAttention"),
          membershipsHint: td("todayHero.membershipsHint", {
            expired: membershipExpired,
            expiring: membershipExpiring,
          }),
          pendingPayment: td("todayHero.pendingPayment"),
        }}
      />

      <DashboardAttentionCenter
        cases={essentialCases}
        casesTotal={essentialCasesTotal}
        fullClasses={data.fullClasses}
        lowOccupancyClasses={data.lowOccupancyClasses}
        birthdayAlerts={data.birthdayAlerts}
        pendingPaymentCount={data.executive.pendingPayment}
        locale={locale}
        boxName={data.boxName}
        followUpSummary={{
          neverContactedAttention,
          followUpOverdue: seguimientos.counts.followUpOverdue,
          followUpToday: seguimientos.counts.followUpToday,
        }}
        labels={{
          title: td("attention.title"),
          subtitle: td("attention.subtitle"),
          priorityHigh: td("alerts.priorityHigh"),
          priorityMedium: td("alerts.priorityMedium"),
          priorityInfo: td("attention.priorityInfo"),
          levelHigh: td("attention.levelHigh"),
          levelMedium: td("attention.levelMedium"),
          levelLow: td("attention.levelLow"),
          emptyPremium: td("alerts.emptyPremium"),
          seeMore: td("attention.seeMore"),
          openProfile: td("attention.openProfile"),
          lastAttendance: td("attention.lastAttendance"),
          membership: td("attention.membership"),
          membershipStatuses,
          fullClasses: td("attention.fullClasses"),
          lowOccupancy: td("alerts.lowOccupancy"),
          pendingPayment: td("alerts.pendingPayment"),
          cupo: td("upcomingClasses.cupo"),
          followUpNeverContacted: td("attention.followUpNeverContacted"),
          followUpOverdue: td("attention.followUpOverdue"),
          followUpToday: td("attention.followUpToday"),
        }}
      />

      <section className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {td("quickActions.title")}
        </p>
        <DashboardQuickActions
          labels={{
            newClass: td("quickActions.newClass"),
            newAthlete: td("quickActions.newAthlete"),
            newCoach: td("quickActions.newCoach"),
            assignMembership: td("quickActions.assignMembership"),
            needsAttention: td("quickActions.needsAttention"),
          }}
        />
      </section>

      <DashboardUpcomingClasses
        classes={data.todayClasses}
        labels={{
          title: td("upcomingClasses.title"),
          empty: td("upcomingClasses.empty"),
          createClass: td("upcomingClasses.createClass"),
          viewCalendar: td("upcomingClasses.viewCalendar"),
          cupo: td("upcomingClasses.cupo"),
          available: td("upcomingClasses.available"),
          lowOccupancyHint: td("upcomingClasses.lowOccupancyHint"),
          status: {
            available: td("upcomingClasses.status.available"),
            almost_full: td("upcomingClasses.status.almostFull"),
            full: td("upcomingClasses.status.full"),
          },
        }}
      />

      <Suspense fallback={<DashboardHeavySkeleton />}>
        <DashboardHeavySection
          locale={locale}
          boxId={profile.box_id!}
          boxName={data.boxName}
          today={data.today}
        />
      </Suspense>
    </div>
  );
}
