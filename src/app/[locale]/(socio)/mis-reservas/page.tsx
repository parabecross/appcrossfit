import { Suspense } from "react";
import { requireRole } from "@/lib/auth/get-profile";

import { getBoxConfig } from "@/lib/box/config";
import { getMembresiaActual } from "@/lib/queries/memberships";
import { getClasesByDateRange } from "@/lib/queries/clases";
import { getSocioClasesDateRange } from "@/lib/clases/helpers";
import { todayInTimezone } from "@/lib/dates/date-only";
import { canReserve } from "@/lib/membresias/helpers";
import { createClient } from "@/lib/supabase/server";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { AthleteHomeDashboard } from "@/components/socio/home/athlete-home-dashboard";
import { AthleteMembershipCard } from "@/components/socio/home/athlete-membership-card";
import {
  AthleteHomeSecondary,
  AthleteHomeSecondaryFallback,
} from "@/components/socio/home/athlete-home-secondary";

export const dynamic = "force-dynamic";

export default async function MisReservasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireRole(locale, ["socio"]);
  const boxConfig = await getBoxConfig(profile.box_id);
  const entitlements = await getBoxEntitlements(profile.box_id!);
  const today = todayInTimezone(boxConfig.timezone);

  const { from, to } = getSocioClasesDateRange(boxConfig.timezone);

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

  const bannerType =
    profile.estado_cuenta === "pendiente_pago"
      ? ("pending" as const)
      : reserveCheck.reason === "expired"
        ? ("expired" as const)
        : null;

  return (
    <AthleteHomeDashboard
      firstName={firstName}
      fullName={profile.nombre_completo}
      fotoUrl={profile.foto_url}
      boxName={boxConfig.name}
      locale={locale}
      gymTimezone={boxConfig.timezone}
      showBanner={showBanner}
      bannerType={bannerType}
      membershipExpiry={membership?.fecha_fin}
      membershipCard={
        <AthleteMembershipCard
          profile={profile}
          membership={membership}
          today={today}
          locale={locale}
        />
      }
      entitlements={entitlements}
      canBook={reserveCheck.ok}
      clases={clases}
      reservas={reservas ?? []}
      profileId={profile.id}
      secondary={
        <Suspense fallback={<AthleteHomeSecondaryFallback />}>
          <AthleteHomeSecondary
            profileId={profile.id}
            boxId={profile.box_id!}
            boxSlug={boxConfig.slug}
            timezone={boxConfig.timezone}
            locale={locale}
            entitlements={entitlements}
          />
        </Suspense>
      }
    />
  );
}
