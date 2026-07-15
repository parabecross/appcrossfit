import { createClient } from "@/lib/supabase/server";
import { getAtletaAttendanceStats } from "@/lib/queries/progreso-attendance";
import { getAtletaProgreso } from "@/lib/queries/progreso";
import { getUserAthronSummary } from "@/lib/ranking/aggregate";
import { buildHomeProgressSnapshot } from "@/lib/socio/home-snapshot";
import { AthleteConstancyCard } from "@/components/socio/home/athlete-constancy";
import { AthleteProgressSnapshot } from "@/components/socio/home/athlete-progress-snapshot";
import { AthleteRankingSnapshot } from "@/components/socio/home/athlete-ranking-snapshot";
import { AthleteBadgesPreview } from "@/components/socio/home/athlete-badges-preview";
import type { BoxEntitlements } from "@/lib/entitlements/types";
import type { AtletaObjetivo } from "@/types/database";

/**
 * Secondary home data: ranking, progress, constancy, badges.
 * Loaded in a Suspense boundary — keeps the essential next-class path fast.
 */
export async function AthleteHomeSecondary({
  profileId,
  boxId,
  boxSlug,
  timezone,
  locale,
  entitlements,
}: {
  profileId: string;
  boxId: string;
  boxSlug: string;
  timezone: string;
  locale: string;
  entitlements: BoxEntitlements;
}) {
  const progresoEnabled = entitlements.features.progreso_atleta;
  const rankingEnabled = entitlements.features.ranking;

  const supabase = await createClient();

  const [attendance, progreso, objetivosRes, ranking] = await Promise.all([
    getAtletaAttendanceStats(profileId, timezone),
    progresoEnabled
      ? getAtletaProgreso(profileId)
      : Promise.resolve({ marcas: [], skills: [], skillHistorial: [] }),
    progresoEnabled
      ? supabase
          .from("atleta_objetivos")
          .select("*")
          .eq("usuario_id", profileId)
      : Promise.resolve({ data: [] as AtletaObjetivo[] }),
    rankingEnabled
      ? getUserAthronSummary({
          boxId,
          boxSlug,
          usuarioId: profileId,
          timezone,
        })
      : Promise.resolve(null),
  ]);

  const objetivos = (objetivosRes.data ?? []) as AtletaObjetivo[];

  const snapshot = buildHomeProgressSnapshot(
    progreso.marcas,
    progreso.skills,
    {
      marcas: progreso.marcas,
      skills: progreso.skills,
      objetivos,
      totalClasses: attendance.totalClasses,
      uniqueTrainingDays: attendance.uniqueTrainingDays,
    }
  );

  return (
    <div className="space-y-6">
      <AthleteConstancyCard
        classesThisWeek={attendance.classesThisWeek}
        classesThisMonth={attendance.classesThisMonth}
        streak={attendance.streak}
      />

      {progresoEnabled ? (
        <>
          <AthleteProgressSnapshot snapshot={snapshot} locale={locale} />
          <AthleteBadgesPreview
            badges={snapshot.previewBadges}
            locale={locale}
          />
        </>
      ) : null}

      <AthleteRankingSnapshot
        summary={ranking}
        locale={locale}
        enabled={Boolean(rankingEnabled)}
        boxSlug={boxSlug}
      />
    </div>
  );
}

export function AthleteHomeSecondaryFallback() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden>
      <div className="h-20 rounded-xl bg-white/[0.04]" />
      <div className="h-28 rounded-xl bg-white/[0.04]" />
      <div className="h-16 rounded-xl bg-white/[0.04]" />
    </div>
  );
}
