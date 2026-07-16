"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MembershipBanner } from "@/components/membresias/membership-banner";
import { AthleteHomeHeader } from "@/components/socio/home/athlete-home-header";
import { AthleteNextClassCard } from "@/components/socio/home/athlete-next-class-card";
import { AthleteExpandableSection } from "@/components/socio/home/athlete-expandable-section";
import { WeeklyCalendar } from "@/components/clases/weekly-calendar";
import { FeatureGate } from "@/components/plans/feature-gate";
import { findNextBookedClass } from "@/lib/reservas/next-booking";
import {
  greetingPeriodFromHour,
  hourInTimezone,
  resolveHomeBookingContext,
} from "@/lib/socio/home-snapshot";
import { todayInTimezone } from "@/lib/dates/date-only";
import type { BoxEntitlements } from "@/lib/entitlements/types";
import type { Clase, Reserva } from "@/types/database";

export function AthleteHomeDashboard({
  firstName,
  fullName,
  fotoUrl,
  boxName,
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
  secondary,
}: {
  firstName: string;
  fullName: string;
  fotoUrl: string | null;
  boxName: string;
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
  /** Ranking / progress / constancy / badges — Suspense slot */
  secondary: ReactNode;
}) {
  const t = useTranslations("socioHome");
  const ts = useTranslations("socio");
  const [localReservas, setLocalReservas] = useState(reservas);
  const [serverReservas] = useState(reservas);

  useEffect(() => {
    setLocalReservas(reservas);
  }, [reservas]);

  const today = todayInTimezone(gymTimezone);
  const localNextBooking = useMemo(
    () => findNextBookedClass(clases, localReservas, profileId, gymTimezone),
    [clases, localReservas, profileId, gymTimezone]
  );

  const bookingContext = resolveHomeBookingContext(
    localNextBooking?.clase.fecha ?? null,
    today
  );

  const period = greetingPeriodFromHour(hourInTimezone(gymTimezone));
  const greeting = t(`greetingPeriods.${period}`);
  const contextLine =
    bookingContext === "today"
      ? t("context.hasTraining")
      : bookingContext === "upcoming"
        ? t("context.hasUpcoming")
        : t("context.noBooking");

  return (
    <div className="space-y-6 pb-6 md:space-y-8 md:pb-8 max-w-xl md:max-w-2xl">
      <AthleteHomeHeader
        greeting={greeting}
        firstName={firstName}
        boxName={boxName}
        contextLine={contextLine}
        hasTrainingToday={bookingContext !== "none"}
        fotoUrl={fotoUrl}
        fullName={fullName}
      />

      {showBanner && bannerType ? (
        <MembershipBanner
          type={bannerType}
          expiryDate={membershipExpiry}
          locale={locale}
        />
      ) : null}

      <FeatureGate
        entitlements={entitlements}
        featureKey="reservas"
        title={ts("bookingsSubtitle")}
        description={ts("bookingsSubtitle")}
      >
        <div className="space-y-6">
          {localNextBooking ? (
            <AthleteNextClassCard
              booking={localNextBooking}
              locale={locale}
              gymTimezone={gymTimezone}
              reservas={localReservas}
              profileId={profileId}
              onReservationsChange={setLocalReservas}
            />
          ) : null}

          <div id="horario" className="scroll-mt-24">
            <AthleteExpandableSection
              title={t("sections.bookingTitle")}
              subtitle={
                localNextBooking
                  ? t("sections.bookingSubtitleBooked")
                  : t("sections.bookingSubtitle")
              }
              defaultOpen
              expandLabel={t("sections.expand")}
              collapseLabel={t("sections.collapse")}
            >
              <WeeklyCalendar
                clases={clases}
                reservas={localReservas}
                serverReservas={serverReservas}
                profileId={profileId}
                canBook={canBook}
                locale={locale}
                gymTimezone={gymTimezone}
                hideRankingWidget
                socioCompact
                onReservationsChange={setLocalReservas}
              />
            </AthleteExpandableSection>
          </div>

          {secondary}
        </div>
      </FeatureGate>

      {membershipCard}
    </div>
  );
}
