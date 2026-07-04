import { requireRole } from "@/lib/auth/get-profile";

import { isAdminLikeRole } from "@/lib/auth/roles";
import { getBoxConfig } from "@/lib/box/config";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { canUseFeature } from "@/lib/entitlements/permissions";
import { getClasesByDateRange } from "@/lib/queries/clases";
import {
  getAssignableCoachesForBox,
  isAssignableCoach,
} from "@/lib/queries/coaches";
import { getWeekDates, toDateString } from "@/lib/clases/helpers";
import { createClient } from "@/lib/supabase/server";
import { AdminClasesClient } from "@/components/admin/clases-admin";
import { BirthdayInfoCard } from "@/components/admin/birthday-info-card";
import { LockedFeatureCard } from "@/components/plans/locked-feature-card";
import { getBirthdayAlerts } from "@/lib/queries/birthdays";
import { getTranslations } from "next-intl/server";
import type { Profile, Reserva } from "@/types/database";

export const dynamic = "force-dynamic";

type ReservaRow = Reserva & { profile: Profile | null };

async function fetchReservasForClases(claseIds: string[]): Promise<ReservaRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reservas")
    .select(
      "id, clase_id, usuario_id, fecha_reserva, estado, created_at, profile:profiles!reservas_usuario_id_fkey(nombre_completo)"
    )
    .in("clase_id", claseIds);

  return (data ?? []).map((row) => {
    const profile = row.profile;
    const normalizedProfile = Array.isArray(profile)
      ? profile[0] ?? null
      : profile ?? null;
    return {
      ...row,
      profile: normalizedProfile ?? undefined,
    };
  }) as ReservaRow[];
}

export default async function AdminClasesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireRole(locale, ["admin", "coach", "box_admin"]);
  const t = await getTranslations("classes");
  const entitlements = await getBoxEntitlements(profile.box_id!);
  const canManageClases = canUseFeature(entitlements, "clases");
  const canMarkAttendanceFeature = canUseFeature(entitlements, "asistencia");
  const canAccessPage =
    canManageClases || canMarkAttendanceFeature;

  if (!canAccessPage) {
    const detail = entitlements.featureDetails.find((d) => d.key === "clases");
    const lockedDescription =
      detail?.source === "override" && !detail.enabled
        ? "Esta función fue desactivada para tu box. Contacta a soporte ATHRON."
        : undefined;

    return (
      <LockedFeatureCard
        featureKey="clases"
        title={t("title")}
        description={lockedDescription}
      />
    );
  }

  if (!profile.box_id) {
    throw new Error("Sin box asignado");
  }

  const boxId = profile.box_id;
  const boxConfig = await getBoxConfig(boxId);
  const week = getWeekDates();
  const from = toDateString(week[0]);
  const rangeEnd = new Date(week[6]);
  rangeEnd.setDate(rangeEnd.getDate() + 21);
  const to = toDateString(rangeEnd);

  let clases = await getClasesByDateRange(from, to);
  if (profile.rol === "coach") {
    clases = clases.filter((c) => c.coach_id === profile.id);
  }

  const coaches = isAdminLikeRole(profile.rol)
    ? await getAssignableCoachesForBox(boxId)
    : isAssignableCoach(profile)
      ? [profile]
      : [];

  const claseIds = clases.map((c) => c.id);
  let reservasFiltradas: ReservaRow[] = [];

  if (claseIds.length > 0) {
    reservasFiltradas = await fetchReservasForClases(claseIds);
  }

  const birthdayAlerts = await getBirthdayAlerts(boxId, boxConfig.timezone);

  return (
    <>
      <BirthdayInfoCard alerts={birthdayAlerts} />
      <AdminClasesClient
      clases={clases}
      reservas={reservasFiltradas}
      coaches={coaches}
      profileId={profile.id}
      locale={locale}
      isCoach={profile.rol === "coach"}
      gymTimezone={boxConfig.timezone}
      canManageClases={canManageClases}
      canMarkAttendanceFeature={canMarkAttendanceFeature}
    />
    </>
  );
}
