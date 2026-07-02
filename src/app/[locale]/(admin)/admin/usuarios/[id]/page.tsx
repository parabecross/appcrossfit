import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { getAthleteClassHistory } from "@/lib/queries/athlete-history";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { UserDetailClient } from "@/components/admin/user-detail";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const adminProfile = await requireAdmin(locale);
  const supabase = await createClient();

  const { data: user } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("box_id", adminProfile.box_id)
    .single();

  if (!user) notFound();

  const entitlements = await getBoxEntitlements(adminProfile.box_id!);

  const [{ data: membresias }, { data: planes }, classHistory] =
    await Promise.all([
      supabase
        .from("membresias")
        .select("*, plan:planes(*)")
        .eq("usuario_id", id)
        .order("fecha_fin", { ascending: false }),
      supabase
        .from("planes")
        .select("*")
        .eq("activo", true)
        .eq("box_id", adminProfile.box_id!),
      getAthleteClassHistory(id, adminProfile.box_id!),
    ]);

  return (
    <UserDetailClient
      user={user}
      membresias={membresias ?? []}
      classHistory={classHistory}
      planes={planes ?? []}
      locale={locale}
      entitlements={entitlements}
    />
  );
}
