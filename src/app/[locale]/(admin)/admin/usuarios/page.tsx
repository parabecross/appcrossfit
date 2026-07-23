import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/auth/get-profile";
import { getBoxConfig } from "@/lib/box/config";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { FeatureGate } from "@/components/plans/feature-gate";
import { createClient } from "@/lib/supabase/server";
import { UsuariosTable } from "@/components/admin/usuarios-table";
import { getMembresiasMapForUsuarios } from "@/lib/queries/memberships";
import { buildAdminUsuariosInbox } from "@/lib/queries/admin-usuarios-inbox";
import { loadBoxSeguimientosSnapshot } from "@/lib/queries/seguimientos";
import {
  countInboxViews,
  parseUsuariosInboxFilters,
} from "@/lib/admin/usuarios-filters";
import type { Profile } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminUsuariosPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const adminProfile = await requireAdmin(locale);
  const boxConfig = await getBoxConfig(adminProfile.box_id);
  const entitlements = await getBoxEntitlements(adminProfile.box_id!);
  const tinbox = await getTranslations("admin.athletesInbox");
  const supabase = await createClient();

  const filters = parseUsuariosInboxFilters(sp);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("box_id", adminProfile.box_id)
    .eq("rol", "socio")
    .order("nombre_completo");

  const socios = (profiles ?? []) as Profile[];
  const memMap = await getMembresiasMapForUsuarios(socios.map((p) => p.id));

  const seguimientos = await loadBoxSeguimientosSnapshot(
    adminProfile.box_id!,
    socios.map((s) => s.id)
  );

  const rows = await buildAdminUsuariosInbox(
    socios,
    memMap,
    boxConfig.timezone,
    seguimientos.byAthlete
  );

  const viewCounts = countInboxViews(rows);

  return (
    <FeatureGate
      entitlements={entitlements}
      featureKey="membresias"
      title={tinbox("title")}
      description={tinbox("subtitle")}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black brand-text">{tinbox("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tinbox("subtitle")}
          </p>
        </div>
        <UsuariosTable
          rows={rows}
          locale={locale}
          gymTimezone={boxConfig.timezone}
          boxName={boxConfig.name}
          initialFilters={filters}
          viewCounts={viewCounts}
        />
      </div>
    </FeatureGate>
  );
}
