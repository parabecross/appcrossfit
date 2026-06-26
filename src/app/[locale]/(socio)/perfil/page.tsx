import { requireRole } from "@/lib/auth/get-profile";
import { getBoxConfig } from "@/lib/box/config";
import { getAtletaExpediente } from "@/lib/queries/expediente";
import { ProfileForm } from "@/components/socio/profile-form";
import { ExpedienteSummary } from "@/components/socio/expediente-summary";
import { SportsProfileForm } from "@/components/socio/sports-profile-form";

export default async function PerfilPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireRole(locale, ["socio"]);
  const boxConfig = await getBoxConfig(profile.box_id);
  const expediente = await getAtletaExpediente(profile.id, boxConfig.timezone);

  return (
    <div className="space-y-8 pb-24 md:pb-0">
      <ProfileForm profile={profile} />
      <ExpedienteSummary
        marcas={expediente.marcas}
        skills={expediente.skills}
        objetivos={expediente.objetivos}
        activeGoal={expediente.activeGoal}
        attendance={expediente.attendance}
      />
      <SportsProfileForm
        profileId={profile.id}
        initial={expediente.perfilDeportivo}
      />
    </div>
  );
}
