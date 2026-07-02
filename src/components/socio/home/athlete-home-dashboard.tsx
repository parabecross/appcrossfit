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

      {membershipCard}

      <FeatureGate
        entitlements={entitlements}
        featureKey="reservas"
        title={ts("bookingsSubtitle")}
        description={ts("bookingsSubtitle")}
      >
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-white/5">
            <p className="text-sm font-bold">{t("sections.bookingTitle")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {localNextBooking
                ? t("sections.bookingSubtitleBooked")
                : t("sections.bookingSubtitle")}
            </p>
          </div>

          {localNextBooking && (
            <div className="px-4 py-3 border-b border-white/5">
              <AthleteNextClassCard
                booking={localNextBooking}
                locale={locale}
                gymTimezone={gymTimezone}
                reservas={localReservas}
                serverReservas={serverReservas}
                profileId={profileId}
                onReservationsChange={setLocalReservas}
              />
            </div>
          )}

          <div className="p-4">
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
              onReservationsChange={setLocalReservas}
            />
          </div>
        </section>
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
