import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/auth/get-profile";
import { getBoxConfig } from "@/lib/box/config";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { FeatureGate } from "@/components/plans/feature-gate";
import { createClient } from "@/lib/supabase/server";
import { UsuariosTable } from "@/components/admin/usuarios-table";
import { getMembresiasMapForUsuarios } from "@/lib/queries/memberships";
import type { Profile } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminUsuariosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const adminProfile = await requireAdmin(locale);
  const boxConfig = await getBoxConfig(adminProfile.box_id);
  const entitlements = await getBoxEntitlements(adminProfile.box_id!);
  const t = await getTranslations("nav");
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("box_id", adminProfile.box_id)
    .eq("rol", "socio")
    .order("nombre_completo");

  const socios = (profiles ?? []) as Profile[];
  const memMap = await getMembresiasMapForUsuarios(socios.map((p) => p.id));
  const users = socios.map((p) => ({
    ...p,
    membresia: memMap.get(p.id) ?? null,
  }));

  return (
    <FeatureGate
      entitlements={entitlements}
      featureKey="membresias"
      title={t("users")}
      description={t("users")}
    >
      <div className="space-y-6">
        <h1 className="text-3xl font-black brand-text">{t("users")}</h1>
        <UsuariosTable
          users={users}
          locale={locale}
          gymTimezone={boxConfig.timezone}
        />
      </div>
    </FeatureGate>
  );
}
