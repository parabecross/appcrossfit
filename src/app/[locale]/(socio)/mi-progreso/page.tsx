import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth/get-profile";
import { getBoxConfig } from "@/lib/box/config";
import { getAtletaExpediente } from "@/lib/queries/expediente";
import { AthleteProgress } from "@/components/socio/athlete-progress";
import { SocioPageHeader } from "@/components/socio/socio-page-header";

export default async function MiProgresoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("progress");
  const profile = await requireRole(locale, ["socio"]);
  const boxConfig = await getBoxConfig(profile.box_id);
  const expediente = await getAtletaExpediente(profile.id, boxConfig.timezone);

  return (
    <div className="space-y-6 pb-24 md:pb-0 md:max-w-4xl md:mx-auto w-full">
      <SocioPageHeader
        title={t("expediente.title")}
        subtitle={t("expediente.pageSubtitle")}
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
    </div>
  );
}
