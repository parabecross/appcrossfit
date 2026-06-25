import { requireRole } from "@/lib/auth/get-profile";
import { getClasesByDateRange } from "@/lib/queries/clases";
import { getCoaches } from "@/lib/queries/memberships";
import { getWeekDates, toDateString } from "@/lib/clases/helpers";
import { createClient } from "@/lib/supabase/server";
import { AdminClasesClient } from "@/components/admin/clases-admin";

export default async function AdminClasesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireRole(locale, ["admin", "coach"]);
  const week = getWeekDates();
  const from = toDateString(week[0]);
  const to = toDateString(week[6]);

  const [clases, coaches] = await Promise.all([
    getClasesByDateRange(from, to),
    getCoaches(),
  ]);

  const supabase = await createClient();
  const { data: reservas } = await supabase
    .from("reservas")
    .select("*, profile:profiles!reservas_usuario_id_fkey(*)");

  return (
    <AdminClasesClient
      clases={clases}
      reservas={reservas ?? []}
      coaches={coaches}
      profileId={profile.id}
      locale={locale}
    />
  );
}
