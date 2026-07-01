import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth/get-profile";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { FeatureGate } from "@/components/plans/feature-gate";
import { createClient } from "@/lib/supabase/server";
import { PlanesAdmin } from "@/components/admin/planes-admin";

export default async function AdminPlanesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireAdmin(locale);
  const t = await getTranslations("plans");
  const entitlements = await getBoxEntitlements(profile.box_id!);
  const supabase = await createClient();
  const { data: planes } = await supabase
    .from("planes")
    .select("*")
    .eq("box_id", profile.box_id!)
    .order("nombre");

  return (
    <FeatureGate
      entitlements={entitlements}
      featureKey="membresias"
      title={t("title")}
      description={t("title")}
    >
      <PlanesAdmin planes={planes ?? []} boxId={profile.box_id!} />
    </FeatureGate>
  );
}
