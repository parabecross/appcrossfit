import { createClient } from "@/lib/supabase/server";

import { requireRole } from "@/lib/auth/get-profile";
import { getBoxConfig } from "@/lib/box/config";
import { getMembresiaActual } from "@/lib/queries/memberships";
import { getAtletaAttendanceStats } from "@/lib/queries/progreso-attendance";
import { getAtletaProgreso } from "@/lib/queries/progreso";
import { getUserAthronSummary } from "@/lib/ranking/aggregate";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { getRecordTipo } from "@/lib/progreso/helpers";
import { ProfileForm } from "@/components/socio/profile-form";
import { AthleteProfileSummary } from "@/components/socio/athlete-profile-summary";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function PerfilPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireRole(locale, ["socio"]);
  const boxConfig = await getBoxConfig(profile.box_id);
  const entitlements = await getBoxEntitlements(profile.box_id!);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [membership, attendance, progreso, ranking] = await Promise.all([
    getMembresiaActual(profile.id),
    getAtletaAttendanceStats(profile.id, boxConfig.timezone),
    entitlements.features.progreso_atleta
      ? getAtletaProgreso(profile.id)
      : Promise.resolve({ marcas: [], skills: [], skillHistorial: [] }),
    entitlements.features.ranking
      ? getUserAthronSummary({
          boxId: profile.box_id!,
          boxSlug: boxConfig.slug,
          usuarioId: profile.id,
          timezone: boxConfig.timezone,
        })
      : Promise.resolve(null),
  ]);

  const tMem = await getTranslations("socioHome.membership");
  const tm = await getTranslations("membership.status");
  const membershipLabel = membership
    ? `${membership.plan?.nombre ?? tMem("none")} · ${tm(membership.estado)}`
    : tMem("none");

  const prCount = progreso.marcas.filter((m) => getRecordTipo(m) === "pr").length;
  const skillCount = progreso.skills.filter(
    (s) => s.estado === "logrado" || s.estado === "dominado"
  ).length;

  return (
    <div className="space-y-5">
      <AthleteProfileSummary
        nombre={profile.nombre_completo}
        fotoUrl={profile.foto_url}
        boxName={boxConfig.name}
        attendances={attendance.totalClasses}
        prCount={prCount}
        skillCount={skillCount}
        rank={ranking?.month_rank ?? null}
        membershipLabel={membershipLabel}
      />
      <ProfileForm profile={profile} email={user?.email} />
    </div>
  );
}
