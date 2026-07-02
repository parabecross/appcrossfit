import { requireRole } from "@/lib/auth/get-profile";

import { getBoxConfig } from "@/lib/box/config";
import { createClient } from "@/lib/supabase/server";
import { LegacyClient } from "@/components/legacy/legacy-client";
import type { AtletaObjetivo, AtletaPerfilDeportivo } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function LegacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireRole(locale, ["socio"]);
  const boxConfig = await getBoxConfig(profile.box_id);
  const supabase = await createClient();

  const [{ data: perfilDeportivo }, { data: objetivos }] = await Promise.all([
    supabase
      .from("atleta_perfil_deportivo")
      .select("*")
      .eq("usuario_id", profile.id)
      .maybeSingle(),
    supabase
      .from("atleta_objetivos")
      .select("*")
      .eq("usuario_id", profile.id)
      .eq("estado", "en_proceso")
      .order("updated_at", { ascending: false })
      .limit(1),
  ]);

  const activeGoal = (objetivos?.[0] ?? null) as AtletaObjetivo | null;

  return (
    <LegacyClient
      profile={profile}
      perfilDeportivo={(perfilDeportivo ?? null) as AtletaPerfilDeportivo | null}
      activeGoal={activeGoal}
      boxName={boxConfig.name}
      boxLogoUrl={boxConfig.logoUrl}
    />
  );
}
