import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth/get-profile";
import { getMembresiaActual } from "@/lib/queries/memberships";
import { getClasesByDateRange } from "@/lib/queries/clases";
import { getWeekDates, toDateString } from "@/lib/clases/helpers";
import { canReserve } from "@/lib/membresias/helpers";
import { createClient } from "@/lib/supabase/server";
import { WeeklyCalendar } from "@/components/clases/weekly-calendar";
import { MembershipBanner } from "@/components/membresias/membership-banner";

export default async function MisReservasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("nav");
  const profile = await requireRole(locale, ["socio"]);

  const week = getWeekDates();
  const from = toDateString(week[0]);
  const to = toDateString(week[6]);

  const supabase = await createClient();
  const [clases, membership, { data: reservas }] = await Promise.all([
    getClasesByDateRange(from, to),
    getMembresiaActual(profile.id),
    supabase.from("reservas").select("*").eq("usuario_id", profile.id),
  ]);

  const reserveCheck = canReserve(profile, membership);
  const showBanner =
    profile.estado_cuenta === "pendiente_pago" ||
    reserveCheck.reason === "expired";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-black brand-text">
        {t("myBookings")}
      </h1>

      {showBanner && (
        <MembershipBanner
          type={
            profile.estado_cuenta === "pendiente_pago" ? "pending" : "expired"
          }
          expiryDate={membership?.fecha_fin}
          locale={locale}
        />
      )}

      <WeeklyCalendar
        clases={clases}
        reservas={reservas ?? []}
        profileId={profile.id}
        canBook={reserveCheck.ok}
        locale={locale}
      />
    </div>
  );
}
