import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UserDetailClient } from "@/components/admin/user-detail";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const { data: user } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (!user) notFound();

  const { data: membresias } = await supabase
    .from("membresias")
    .select("*, plan:planes(*)")
    .eq("usuario_id", id)
    .order("fecha_fin", { ascending: false });

  const { data: reservas } = await supabase
    .from("reservas")
    .select("*")
    .eq("usuario_id", id);

  const { data: planes } = await supabase
    .from("planes")
    .select("*")
    .eq("activo", true);

  return (
    <UserDetailClient
      user={user}
      membresias={membresias ?? []}
      reservas={reservas ?? []}
      planes={planes ?? []}
      locale={locale}
    />
  );
}
