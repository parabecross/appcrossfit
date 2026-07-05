"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { WeeklyCalendar } from "@/components/clases/weekly-calendar";
import { SocioClassHistory } from "@/components/clases/socio-class-history";
import { MembershipBanner } from "@/components/membresias/membership-banner";
import { AthleteNextClassCard } from "@/components/socio/home/athlete-next-class-card";
import { AthleteExpandableSection } from "@/components/socio/home/athlete-expandable-section";
import { FeatureGate } from "@/components/plans/feature-gate";
import type { ClaseScoreWithProfile } from "@/lib/queries/class-scores";
import type { AthleteClassHistoryItem } from "@/lib/queries/athlete-history";
import { findNextBookedClass } from "@/lib/reservas/next-booking";
import type { BoxEntitlements } from "@/lib/entitlements/types";
import type { AthleticLevel, Clase, ClaseScore, Reserva } from "@/types/database";
import type { ReactNode } from "react";

export function AthleteHomeDashboard({
  firstName,
  locale,
  gymTimezone,
  showBanner,
  bannerType,
  membershipExpiry,
  membershipCard,
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
  showBanner: boolean;
  bannerType: "pending" | "expired" | null;
  membershipExpiry?: string;
  membershipCard: ReactNode;
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
  const [localReservas, setLocalReservas] = useState(reservas);
  const [serverReservas] = useState(reservas);

  useEffect(() => {
    setLocalReservas(reservas);
  }, [reservas]);

  const localNextBooking = useMemo(
    () => findNextBookedClass(clases, localReservas, profileId, gymTimezone),
    [clases, localReservas, profileId, gymTimezone]
  );

  return (
    <div className="space-y-4 pb-2 md:space-y-6 md:pb-4">
      <header>
        <h1 className="text-xl font-bold brand-text leading-tight md:text-3xl md:font-black">
          {t("greeting", { name: firstName })}
        </h1>
        <p className="hidden md:block text-sm text-muted-foreground mt-1">
          {t("tagline")}
        </p>
      </header>

      {showBanner && bannerType && (
        <MembershipBanner
          type={bannerType}
          expiryDate={membershipExpiry}
          locale={locale}
        />
      )}

      {membershipCard}

      <FeatureGate
        entitlements={entitlements}
        featureKey="reservas"
        title={ts("bookingsSubtitle")}
        description={ts("bookingsSubtitle")}
      >
        <div className="space-y-3">
          {localNextBooking ? (
            <AthleteNextClassCard
              booking={localNextBooking}
              locale={locale}
              gymTimezone={gymTimezone}
              reservas={localReservas}
              serverReservas={serverReservas}
              profileId={profileId}
              onReservationsChange={setLocalReservas}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-3">
              <p className="text-sm font-medium">{t("nextClass.emptyTitle")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("nextClass.emptyDesc")}
              </p>
            </div>
          )}

          <WeeklyCalendar
            clases={clases}
            reservas={localReservas}
            serverReservas={serverReservas}
            profileId={profileId}
            canBook={canBook}
            locale={locale}
            gymTimezone={gymTimezone}
            classScores={classScores}
            athleteLevel={athleteLevel}
            hideRankingWidget
            socioCompact
            onReservationsChange={setLocalReservas}
          />
        </div>
      </FeatureGate>

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
