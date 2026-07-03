import { getTranslations } from "next-intl/server";

import { requireRole } from "@/lib/auth/get-profile";
import { getBoxConfig } from "@/lib/box/config";
import { AtletasResumenList } from "@/components/admin/mis-atletas/atletas-resumen-list";
import {
  EMPTY_MARCAS,
  EMPTY_SKILLS,
  getActiveObjetivosMapForUsuarios,
  getAtletaSkillsAndMarcasSummaryMap,
} from "@/lib/queries/atleta-summary";
import { getMembresiasMapForUsuariosInBox } from "@/lib/queries/memberships";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function MisAtletasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireRole(locale, ["coach", "admin", "box_admin"]);
  const t = await getTranslations("myAthletes");
  const boxConfig = await getBoxConfig(profile.box_id);

  if (!profile.box_id) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black brand-text">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <div className="rounded-xl border border-dashed border-white/10 py-12 text-center">
          <p className="font-semibold">{t("emptyTitle")}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {t("emptyDescription")}
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("box_id", profile.box_id)
    .eq("rol", "socio")
    .order("nombre_completo");

  const socios = (profiles ?? []) as Profile[];
  const usuarioIds = socios.map((p) => p.id);

  const [memMap, { skillsMap, marcasMap }, objetivosMap] = await Promise.all([
    getMembresiasMapForUsuariosInBox(usuarioIds, profile.box_id),
    getAtletaSkillsAndMarcasSummaryMap(usuarioIds),
    getActiveObjetivosMapForUsuarios(usuarioIds),
  ]);

  const athletes = socios.map((socio) => ({
    profile: socio,
    membresia: memMap.get(socio.id) ?? null,
    skills: skillsMap.get(socio.id) ?? EMPTY_SKILLS,
    marcas: marcasMap.get(socio.id) ?? EMPTY_MARCAS,
    activeGoal: objetivosMap.get(socio.id) ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black brand-text">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>
      <AtletasResumenList
        athletes={athletes}
        locale={locale}
        gymTimezone={boxConfig.timezone}
      />
    </div>
  );
}
