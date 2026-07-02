import { getTranslations } from "next-intl/server";

import { requireRole } from "@/lib/auth/get-profile";
import { getBoxConfig } from "@/lib/box/config";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { getAtletaExpediente } from "@/lib/queries/expediente";
import { getUserAthronSummary } from "@/lib/ranking/aggregate";
import { AthleteProgress } from "@/components/socio/athlete-progress";
import { AthronProgressSection } from "@/components/ranking/athron/athron-progress-section";
import { SocioPageHeader } from "@/components/socio/socio-page-header";
import { FeatureGate } from "@/components/plans/feature-gate";

export const dynamic = "force-dynamic";

export default async function MiProgresoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("progress");
  const profile = await requireRole(locale, ["socio"]);
  const boxConfig = await getBoxConfig(profile.box_id);
  const entitlements = await getBoxEntitlements(profile.box_id!);
  const [expediente, athronSummary] = await Promise.all([
    getAtletaExpediente(profile.id, boxConfig.timezone),
    getUserAthronSummary({
      boxId: profile.box_id!,
      boxSlug: boxConfig.slug,
      usuarioId: profile.id,
      timezone: boxConfig.timezone,
    }),
  ]);

  return (
    <div className="space-y-6 pb-24 md:pb-0 md:max-w-4xl md:mx-auto w-full">
      <SocioPageHeader
        title={t("expediente.title")}
        subtitle={t("expediente.pageSubtitle")}
      />
      <FeatureGate
        entitlements={entitlements}
        featureKey="progreso_atleta"
        title={t("expediente.title")}
        description={t("expediente.pageSubtitle")}
      >
        <AthronProgressSection
          summary={athronSummary}
          locale={locale}
          boxSlug={boxConfig.slug}
        />
        <AthleteProgress
          profileId={profile.id}
          marcas={expediente.marcas}
          skills={expediente.skills}
          skillHistorial={expediente.skillHistorial}
          objetivos={expediente.objetivos}
          activeGoal={expediente.activeGoal}
          attendance={expediente.attendance}
          locale={locale}
        />
      </FeatureGate>
    </div>
  );
}
