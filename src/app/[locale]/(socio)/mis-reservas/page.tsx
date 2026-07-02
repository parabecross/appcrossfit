import { requireRole } from "@/lib/auth/get-profile";
import { getBoxConfig } from "@/lib/box/config";
import { getMembresiaActual } from "@/lib/queries/memberships";
import { getClasesByDateRange } from "@/lib/queries/clases";
import { getAthleteClassHistory } from "@/lib/queries/athlete-history";
import {
  getScoresByUsuario,
  getScoresForClases,
  scoresByClaseId,
} from "@/lib/queries/class-scores";
import { getUserAthronSummary } from "@/lib/ranking/aggregate";
import { enrichScoresForSocio, getAthleteLevel } from "@/lib/queries/daily-ranking";
import { getSocioClasesDateRange } from "@/lib/clases/helpers";
import { canReserve } from "@/lib/membresias/helpers";
import { findNextBookedClass } from "@/lib/reservas/next-booking";
import { createClient } from "@/lib/supabase/server";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { AthleteHomeDashboard } from "@/components/socio/home/athlete-home-dashboard";
import { AthleteMembershipCard } from "@/components/socio/home/athlete-membership-card";

export default async function MisReservasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireRole(locale, ["socio"]);
  const boxConfig = await getBoxConfig(profile.box_id);
  const entitlements = await getBoxEntitlements(profile.box_id!);

  const { from, to } = getSocioClasesDateRange(boxConfig.timezone);

  const supabase = await createClient();
  const [clases, membership, { data: reservas }, classHistory] =
    await Promise.all([
      getClasesByDateRange(from, to),
      getMembresiaActual(profile.id),
      supabase.from("reservas").select("*").eq("usuario_id", profile.id),
      getAthleteClassHistory(profile.id, profile.box_id!),
    ]);

  const claseIds = clases.map((c) => c.id);
  const [rawClassScores, myScores, athleteLevel, athronSummary] =
    await Promise.all([
      getScoresForClases(claseIds),
      getScoresByUsuario(profile.id),
      getAthleteLevel(profile.id),
      getUserAthronSummary({
        boxId: profile.box_id!,
        boxSlug: boxConfig.slug,
        usuarioId: profile.id,
        timezone: boxConfig.timezone,
      }),
    ]);
  const classScores = await enrichScoresForSocio(rawClassScores);
  const myScoresMap = scoresByClaseId(myScores);

  const reserveCheck = canReserve(profile, membership);
  const showBanner =
    profile.estado_cuenta === "pendiente_pago" ||
    reserveCheck.reason === "expired";

  const firstName = profile.nombre_completo.split(" ")[0];
  const attended = classHistory.filter((r) => r.estado === "asistio").length;
  const noShow = classHistory.filter((r) => r.estado === "no_asistio").length;

  const nextBooking = findNextBookedClass(
    clases,
    reservas ?? [],
    profile.id,
    boxConfig.timezone
  );

  const bannerType =
    profile.estado_cuenta === "pendiente_pago"
      ? ("pending" as const)
      : reserveCheck.reason === "expired"
        ? ("expired" as const)
        : null;

  return (
    <AthleteHomeDashboard
      firstName={firstName}
      locale={locale}
      gymTimezone={boxConfig.timezone}
      boxSlug={boxConfig.slug}
      showBanner={showBanner}
      bannerType={bannerType}
      membershipExpiry={membership?.fecha_fin}
      nextBooking={nextBooking}
      membershipCard={
        <AthleteMembershipCard
          profile={profile}
          membership={membership}
          locale={locale}
        />
      }
      athronSummary={athronSummary}
      entitlements={entitlements}
      canBook={reserveCheck.ok}
      clases={clases}
      reservas={reservas ?? []}
      profileId={profile.id}
      classScores={classScores}
      athleteLevel={athleteLevel}
      classHistory={classHistory}
      historySummary={{ attended, noShow }}
      scoresByClaseId={myScoresMap}
    />
  );
}
