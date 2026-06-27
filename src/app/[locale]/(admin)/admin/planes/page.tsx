import { requireAdmin } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { PlanesAdmin } from "@/components/admin/planes-admin";

export default async function AdminPlanesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireAdmin(locale);
  const supabase = await createClient();
  const { data: planes } = await supabase
    .from("planes")
    .select("*")
    .eq("box_id", profile.box_id!)
    .order("nombre");

  return <PlanesAdmin planes={planes ?? []} boxId={profile.box_id!} />;
}
