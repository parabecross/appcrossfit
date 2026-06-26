import { requireRole } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/socio/profile-form";
import type { AtletaPerfilDeportivo } from "@/types/database";

export default async function PerfilPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireRole(locale, ["socio"]);
  const supabase = await createClient();

  const { data: perfilDeportivo } = await supabase
    .from("atleta_perfil_deportivo")
    .select("*")
    .eq("usuario_id", profile.id)
    .maybeSingle();

  return (
    <ProfileForm
      profile={profile}
      perfilDeportivo={(perfilDeportivo ?? null) as AtletaPerfilDeportivo | null}
    />
  );
}
