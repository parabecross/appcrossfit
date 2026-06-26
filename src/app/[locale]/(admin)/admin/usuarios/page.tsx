import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { UsuariosTable } from "@/components/admin/usuarios-table";
import { getMembresiaActual } from "@/lib/queries/memberships";
import type { Profile } from "@/types/database";

export default async function AdminUsuariosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const adminProfile = await requireAdmin(locale);
  const t = await getTranslations("nav");
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("box_id", adminProfile.box_id)
    .eq("rol", "socio")
    .order("nombre_completo");

  const users = await Promise.all(
    ((profiles ?? []) as Profile[]).map(async (p) => ({
      ...p,
      membresia: await getMembresiaActual(p.id),
    }))
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black brand-text">{t("users")}</h1>
      <UsuariosTable users={users} locale={locale} />
    </div>
  );
}
