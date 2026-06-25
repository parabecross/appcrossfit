import { requireAdmin } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { PlanesAdmin } from "@/components/admin/planes-admin";

export default async function AdminPlanesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale);
  const supabase = await createClient();
  const { data: planes } = await supabase
    .from("planes")
    .select("*")
    .order("nombre");

  return <PlanesAdmin planes={planes ?? []} />;
}
