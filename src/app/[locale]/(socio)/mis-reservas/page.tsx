import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth/get-profile";

import { getBoxConfig } from "@/lib/box/config";
import { getMembresiaActual } from "@/lib/queries/memberships";
import { getClasesByDateRange } from "@/lib/queries/clases";
import { getSocioClasesDateRange } from "@/lib/clases/helpers";
import { todayInTimezone } from "@/lib/dates/date-only";
import { canReserve } from "@/lib/membresias/helpers";
import { createClient } from "@/lib/supabase/server";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { AthleteHomeDashboard } from "@/components/socio/home/athlete-home-dashboard";
import {
  AthleteHomeConstancy,
  AthleteHomeConstancyFallback,
} from "@/components/socio/home/athlete-home-constancy";
import { AthleteHomeHistorySection } from "@/components/socio/home/athlete-home-history-section";
import { getAthleteClassHistory } from "@/lib/queries/athlete-history";
import {
  getScoresByUsuario,
  getScoresForClases,
  scoresByClaseId,
} from "@/lib/queries/class-scores";

export const dynamic = "force-dynamic";

export default async function MisReservasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireRole(locale, ["socio"]);
  const boxConfig = await getBoxConfig(profile.box_id);
  const entitlements = await getBoxEntitlements(profile.box_id!);
  const tHome = await getTranslations("socioHome");

  const { from, to } = getSocioClasesDateRange(boxConfig.timezone);
  const today = todayInTimezone(boxConfig.timezone);

  const supabase = await createClient();
  const [clases, membership, { data: reservas }, historyAll, scoresUsuario] =
    await Promise.all([
      getClasesByDateRange(from, to),
      getMembresiaActual(profile.id),
      supabase.from("reservas").select("*").eq("usuario_id", profile.id),
      getAthleteClassHistory(profile.id, profile.box_id!),
      getScoresByUsuario(profile.id),
    ]);

  const classScores = await getScoresForClases(clases.map((c) => c.id));

  /**
   * Historial: todas las clases anteriores a hoy (zona del box).
   * Hoy y futuras viven en el calendario (no duplicar reservas activas).
   */
  const historyItems = historyAll.filter((item) => item.clase.fecha < today);

  const reserveCheck = canReserve(profile, membership);
  const showBanner =
    profile.estado_cuenta === "pendiente_pago" ||
    reserveCheck.reason === "expired";

  const firstName = profile.nombre_completo.split(" ")[0];

  const bannerType =
    profile.estado_cuenta === "pendiente_pago"
      ? ("pending" as const)
      : reserveCheck.reason === "expired"
        ? ("expired" as const)
        : null;

  const attended = historyItems.filter((r) => r.estado === "asistio").length;
  const noShow = historyItems.filter((r) => r.estado === "no_asistio").length;

  return (
    <AthleteHomeDashboard
      firstName={firstName}
      fullName={profile.nombre_completo}
      fotoUrl={profile.foto_url}
      boxName={boxConfig.name}
      locale={locale}
      gymTimezone={boxConfig.timezone}
      showBanner={showBanner}
      bannerType={bannerType}
      membershipExpiry={membership?.fecha_fin}
      entitlements={entitlements}
      canBook={reserveCheck.ok}
      clases={clases}
      reservas={reservas ?? []}
      profileId={profile.id}
      classScores={classScores}
      constancy={
        <Suspense fallback={<AthleteHomeConstancyFallback />}>
          <AthleteHomeConstancy
            profileId={profile.id}
            timezone={boxConfig.timezone}
          />
        </Suspense>
      }
      history={
        <AthleteHomeHistorySection
          items={historyItems}
          locale={locale}
          gymTimezone={boxConfig.timezone}
          profileId={profile.id}
          scoresByClaseId={scoresByClaseId(scoresUsuario)}
          summary={tHome("sections.historySubtitle", {
            attended,
            noShow,
          })}
        />
      }
    />
  );
}
