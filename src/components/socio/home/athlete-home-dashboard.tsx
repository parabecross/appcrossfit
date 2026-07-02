"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { WeeklyCalendar } from "@/components/clases/weekly-calendar";
import { SocioClassHistory } from "@/components/clases/socio-class-history";
import { MembershipBanner } from "@/components/membresias/membership-banner";
import { AthleteNextClassCard } from "@/components/socio/home/athlete-next-class-card";
import { AthleteRankingSnapshot } from "@/components/socio/home/athlete-ranking-snapshot";
import { AthleteQuickActions } from "@/components/socio/home/athlete-quick-actions";
import { AthleteExpandableSection } from "@/components/socio/home/athlete-expandable-section";
import { FeatureGate } from "@/components/plans/feature-gate";
import type { ClaseScoreWithProfile } from "@/lib/queries/class-scores";
import type { AthleteClassHistoryItem } from "@/lib/queries/athlete-history";
import type { NextBookedClass } from "@/lib/reservas/next-booking";
import type { UserAthronSummary } from "@/lib/ranking/aggregate";
import type { BoxEntitlements } from "@/lib/entitlements/types";
import type { AthleticLevel, Clase, ClaseScore, Reserva } from "@/types/database";
import type { ReactNode } from "react";

export function AthleteHomeDashboard({
  firstName,
  locale,
  gymTimezone,
  boxSlug,
  showBanner,
  bannerType,
  membershipExpiry,
  nextBooking,
  membershipCard,
  athronSummary,
  entitlements,
  canBook,
  clases,
  reservas,
  profileId,
  classScores,
  athleteLevel,
  classHistory,
  historySummary,
  scoresByClaseId,
}: {
  firstName: string;
  locale: string;
  gymTimezone: string;
  boxSlug: string;
  showBanner: boolean;
  bannerType: "pending" | "expired" | null;
  membershipExpiry?: string;
  nextBooking: NextBookedClass | null;
  membershipCard: ReactNode;
  athronSummary: UserAthronSummary | null;
  entitlements: BoxEntitlements;
  canBook: boolean;
  clases: Clase[];
  reservas: Reserva[];
  profileId: string;
  classScores: ClaseScoreWithProfile[];
  athleteLevel: AthleticLevel | null;
  classHistory: AthleteClassHistoryItem[];
  historySummary: { attended: number; noShow: number };
  scoresByClaseId: Map<string, ClaseScore>;
}) {
  const t = useTranslations("socioHome");
  const ts = useTranslations("socio");
  const bookingRef = useRef<HTMLDivElement>(null);
  const [bookingOpen, setBookingOpen] = useState(!nextBooking);

  const scrollToBooking = () => {
    setBookingOpen(true);
    requestAnimationFrame(() => {
      bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const features = {
    reservas: entitlements.features.reservas,
    ranking: entitlements.features.ranking,
    progreso_atleta: entitlements.features.progreso_atleta,
  };

  return (
    <div className="space-y-6 pb-2">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-black brand-text leading-tight">
          {t("greeting", { name: firstName })}
        </h1>
        <p className="text-sm text-muted-foreground">{t("tagline")}</p>
      </header>

      {showBanner && bannerType && (
        <MembershipBanner
          type={bannerType}
          expiryDate={membershipExpiry}
          locale={locale}
        />
      )}

      <FeatureGate
        entitlements={entitlements}
        featureKey="reservas"
        title={ts("bookingsSubtitle")}
        description={ts("bookingsSubtitle")}
      >
        <AthleteNextClassCard
          booking={nextBooking}
          locale={locale}
          gymTimezone={gymTimezone}
          reservas={reservas}
          onBookNow={scrollToBooking}
          canBook={canBook}
        />
      </FeatureGate>

      <div className="grid gap-4 md:grid-cols-2">
        {membershipCard}
        <AthleteRankingSnapshot
          summary={athronSummary}
          locale={locale}
          enabled={features.ranking}
          boxSlug={boxSlug}
        />
      </div>

      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-0.5">
          {t("quickActionsTitle")}
        </p>
        <AthleteQuickActions
          onBook={scrollToBooking}
          features={features}
          boxSlug={boxSlug}
        />
      </section>

      <div ref={bookingRef}>
        <FeatureGate
          entitlements={entitlements}
          featureKey="reservas"
          title={ts("bookingsSubtitle")}
          description={ts("bookingsSubtitle")}
        >
          <AthleteExpandableSection
            title={t("sections.bookingTitle")}
            subtitle={t("sections.bookingSubtitle")}
            open={bookingOpen}
            onOpenChange={setBookingOpen}
            expandLabel={t("sections.expand")}
            collapseLabel={t("sections.collapse")}
          >
            <WeeklyCalendar
              clases={clases}
              reservas={reservas}
              profileId={profileId}
              canBook={canBook}
              locale={locale}
              gymTimezone={gymTimezone}
              classScores={classScores}
              athleteLevel={athleteLevel}
              athronSummary={athronSummary}
              hideRankingWidget
            />
          </AthleteExpandableSection>
        </FeatureGate>
      </div>

      <FeatureGate
        entitlements={entitlements}
        featureKey="historial_completo"
        title={ts("classHistory")}
        description={ts("classHistoryDesc")}
      >
        <AthleteExpandableSection
          title={t("sections.historyTitle")}
          subtitle={t("sections.historySubtitle", {
            attended: historySummary.attended,
            noShow: historySummary.noShow,
          })}
          defaultOpen={false}
          expandLabel={t("sections.expand")}
          collapseLabel={t("sections.collapse")}
        >
          <SocioClassHistory
            items={classHistory}
            locale={locale}
            gymTimezone={gymTimezone}
            title=""
            description=""
            emptyMessage={ts("noClassHistory")}
            summary={ts("classHistorySummary", {
              attended: historySummary.attended,
              noShow: historySummary.noShow,
            })}
            scoresByClaseId={scoresByClaseId}
            profileId={profileId}
            compact
          />
        </AthleteExpandableSection>
      </FeatureGate>
    </div>
  );
}
