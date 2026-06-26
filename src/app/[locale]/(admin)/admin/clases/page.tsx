import { requireRole } from "@/lib/auth/get-profile";
import { isAdminLikeRole } from "@/lib/auth/roles";
import { getBoxConfig } from "@/lib/box/config";
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
  const profile = await requireRole(locale, ["admin", "coach", "box_admin"]);
  const boxConfig = await getBoxConfig(profile.box_id);
  const week = getWeekDates();
  const from = toDateString(week[0]);
  const rangeEnd = new Date(week[6]);
  rangeEnd.setDate(rangeEnd.getDate() + 21);
  const to = toDateString(rangeEnd);

  let clases = await getClasesByDateRange(from, to);
  if (profile.rol === "coach") {
    clases = clases.filter((c) => c.coach_id === profile.id);
  }

  const coaches =
    isAdminLikeRole(profile.rol) ? await getCoaches() : [profile];

  const supabase = await createClient();
  const { data: reservas } = await supabase
    .from("reservas")
    .select("*, profile:profiles!reservas_usuario_id_fkey(*)");

  const claseIds = new Set(clases.map((c) => c.id));
  const reservasFiltradas = (reservas ?? []).filter((r) =>
    claseIds.has(r.clase_id)
  );

  return (
    <AdminClasesClient
      clases={clases}
      reservas={reservasFiltradas}
      coaches={coaches}
      profileId={profile.id}
      locale={locale}
      isCoach={profile.rol === "coach"}
      gymTimezone={boxConfig.timezone}
    />
  );
}
