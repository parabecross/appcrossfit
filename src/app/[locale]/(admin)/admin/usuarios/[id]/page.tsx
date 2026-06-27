import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { getAthleteClassHistory } from "@/lib/queries/athlete-history";
import { UserDetailClient } from "@/components/admin/user-detail";

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

  const [{ data: membresias }, { data: planes }, classHistory] =
    await Promise.all([
      supabase
        .from("membresias")
        .select("*, plan:planes(*)")
        .eq("usuario_id", id)
        .order("fecha_fin", { ascending: false }),
      supabase.from("planes").select("*").eq("activo", true),
      getAthleteClassHistory(id, adminProfile.box_id!),
    ]);

  return (
    <UserDetailClient
      user={user}
      membresias={membresias ?? []}
      classHistory={classHistory}
      planes={planes ?? []}
      locale={locale}
    />
  );
}
