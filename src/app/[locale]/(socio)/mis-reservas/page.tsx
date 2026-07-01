import { getTranslations } from "next-intl/server";
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
import { createClient } from "@/lib/supabase/server";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { WeeklyCalendar } from "@/components/clases/weekly-calendar";
import { SocioClassHistory } from "@/components/clases/socio-class-history";
import { FeatureGate } from "@/components/plans/feature-gate";
import { MembershipBanner } from "@/components/membresias/membership-banner";
import { SocioPageHeader } from "@/components/socio/socio-page-header";
import { Badge } from "@/components/ui/badge";

export default async function MisReservasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("socio");
  const tm = await getTranslations("membership.status");
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

  return (
    <div className="space-y-5">
      <SocioPageHeader
        title={t("greeting", { name: firstName })}
        subtitle={t("bookingsSubtitle")}
        badge={
          membership?.estado === "vigente" ? (
            <Badge variant="success" className="shrink-0 mt-1">
              {tm("vigente")}
            </Badge>
          ) : membership?.estado === "vencida" ? (
            <Badge variant="destructive" className="shrink-0 mt-1">
              {tm("vencida")}
            </Badge>
          ) : null
        }
      />

      {showBanner && (
        <MembershipBanner
          type={
            profile.estado_cuenta === "pendiente_pago" ? "pending" : "expired"
          }
          expiryDate={membership?.fecha_fin}
          locale={locale}
        />
      )}

      <FeatureGate
        entitlements={entitlements}
        featureKey="reservas"
        title={t("bookingsSubtitle")}
        description={t("bookingsSubtitle")}
      >
      <WeeklyCalendar
        clases={clases}
        reservas={reservas ?? []}
        profileId={profile.id}
        canBook={reserveCheck.ok}
        locale={locale}
        gymTimezone={boxConfig.timezone}
        classScores={classScores}
        athleteLevel={athleteLevel}
        athronSummary={athronSummary}
      />
      </FeatureGate>

      <FeatureGate
        entitlements={entitlements}
        featureKey="historial_completo"
        title={t("classHistory")}
        description={t("classHistoryDesc")}
      >
        <SocioClassHistory
          items={classHistory}
          locale={locale}
          gymTimezone={boxConfig.timezone}
          title={t("classHistory")}
          description={t("classHistoryDesc")}
          emptyMessage={t("noClassHistory")}
          summary={t("classHistorySummary", { attended, noShow })}
          scoresByClaseId={myScoresMap}
          profileId={profile.id}
        />
      </FeatureGate>
    </div>
  );
}
