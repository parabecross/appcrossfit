import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth/get-profile";
import { getBoxConfig } from "@/lib/box/config";
import { getMembresiaActual } from "@/lib/queries/memberships";
import { getClasesByDateRange } from "@/lib/queries/clases";
import { getWeekDates, toDateString } from "@/lib/clases/helpers";
import { canReserve } from "@/lib/membresias/helpers";
import { createClient } from "@/lib/supabase/server";
import { WeeklyCalendar } from "@/components/clases/weekly-calendar";
import { MembershipBanner } from "@/components/membresias/membership-banner";
import { SocioPageHeader } from "@/components/socio/socio-page-header";
import { Badge } from "@/components/ui/badge";

export default async function MisReservasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("socio");
  const tm = await getTranslations("membership.status");
  const profile = await requireRole(locale, ["socio"]);
  const boxConfig = await getBoxConfig(profile.box_id);

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

  const firstName = profile.nombre_completo.split(" ")[0];

  return (
    <div className="space-y-5">
      <SocioPageHeader
        title={t("greeting", { name: firstName })}
        subtitle={t("bookingsSubtitle")}
        badge={
          membership?.estado === "vigente" ? (
            <Badge variant="success" className="shrink-0 mt-1">
              {tm("vigente")}
            </Badge>
          ) : membership?.estado === "vencida" ? (
            <Badge variant="destructive" className="shrink-0 mt-1">
              {tm("vencida")}
            </Badge>
          ) : null
        }
      />

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
        gymTimezone={boxConfig.timezone}
      />
    </div>
  );
}
