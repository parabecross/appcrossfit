import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth/get-profile";
import { getAtletaProgreso } from "@/lib/queries/progreso";
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
  const progreso = await getAtletaProgreso(profile.id);

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <SocioPageHeader title={t("title")} subtitle={t("subtitle")} />
      <AthleteProgress
        profileId={profile.id}
        marcas={progreso.marcas}
        skills={progreso.skills}
        skillHistorial={progreso.skillHistorial}
        locale={locale}
      />
    </div>
  );
}
