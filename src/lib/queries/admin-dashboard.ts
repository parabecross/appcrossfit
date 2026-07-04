import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  computeAverageOccupancy,
  partitionMembershipAlerts,
} from "@/lib/admin/dashboard-helpers";
import { getClasesByDateRange } from "@/lib/queries/clases";
import {
  getAlertasMembresia,
  getKpis,
} from "@/lib/queries/memberships";
import { getBirthdayAlerts } from "@/lib/queries/birthdays";
import { loadDashboardContext } from "@/lib/queries/admin-dashboard-context";
import {
  buildAdminDashboardHeavyData,
  EMPTY_ADMIN_DASHBOARD_HEAVY,
} from "@/lib/queries/admin-dashboard-heavy";
import type {
  AdminDashboardData,
  AdminDashboardEssentialData,
  AdminDashboardHeavyData,
  AdminDashboardTodayClass,
} from "@/lib/queries/admin-dashboard-types";

export type {
  AdminDashboardData,
  AdminDashboardEssentialData,
  AdminDashboardHeavyData,
  AdminDashboardTodayClass,
} from "@/lib/queries/admin-dashboard-types";

function mergeDashboardParts(
  essential: AdminDashboardEssentialData,
  heavy: AdminDashboardHeavyData
): AdminDashboardData {
  const {
    loadError: _unusedLoadError,
    inactiveAthletesCount,
    recentPrsCount,
    attendanceRate,
    ...heavyFields
  } = heavy;
  void _unusedLoadError;
  return {
    ...essential,
    ...heavyFields,
    executive: {
      ...essential.executive,
      recentPrsCount,
      inactiveAthletesCount,
    },
    boxStatus: {
      ...essential.boxStatus,
      attendanceRate,
    },
  };
}

export async function getAdminDashboardEssentialData(
  boxId?: string
): Promise<AdminDashboardEssentialData> {
  const ctx = await loadDashboardContext(boxId);
  const supabase = await createClient();

  const [kpis, alertas, todayClasses, birthdayAlerts] = await Promise.all([
    getKpis(ctx.resolvedBoxId),
    getAlertasMembresia(ctx.resolvedBoxId),
    getClasesByDateRange(ctx.today, ctx.today, ctx.resolvedBoxId),
    getBirthdayAlerts(ctx.resolvedBoxId, ctx.boxConfig.timezone),
  ]);

  const todayClassIds = todayClasses.map((c) => c.id);

  let todayReservas: Array<{
    id: string;
    clase_id: string;
    usuario_id: string;
    estado: string;
    created_at: string;
  }> = [];

  if (todayClassIds.length > 0) {
    const { data } = await supabase
      .from("reservas")
      .select("id, clase_id, usuario_id, estado, created_at")
      .in("clase_id", todayClassIds);
    todayReservas = data ?? [];
  }

  const reservationsToday = todayReservas.filter((r) =>
    ["confirmada", "asistio", "no_asistio"].includes(r.estado)
  ).length;
  const attendanceToday = todayReservas.filter(
    (r) => r.estado === "asistio"
  ).length;

  const classesWithCupo = todayClasses.map((c) => ({
    ...c,
    cupo_ocupado: c.cupo_ocupado ?? 0,
  })) as AdminDashboardTodayClass[];

  const avgOccupancyToday = computeAverageOccupancy(classesWithCupo);
  const membershipAlerts = partitionMembershipAlerts(alertas);

  const lowOccupancyClasses = classesWithCupo.filter((c) => {
    if (c.cupo_maximo <= 0) return false;
    const pct = (c.cupo_ocupado / c.cupo_maximo) * 100;
    return pct < 40 && pct >= 0;
  });

  return {
    today: ctx.today,
    boxName: ctx.boxConfig.name,
    executive: {
      classesToday: todayClasses.length,
      reservationsToday,
      attendanceToday,
      avgOccupancyToday,
      expiringSoon: membershipAlerts.porVencer.length,
      pendingPayment: kpis.pendientes,
    },
    boxStatus: {
      activeMembers: kpis.activos,
      totalMembers: kpis.total,
      expired: kpis.vencidos,
      expiringSoon: membershipAlerts.porVencer.length,
      avgOccupancyToday,
      attendanceToday,
    },
    kpis,
    alertas,
    membershipAlerts,
    todayClasses: classesWithCupo.sort((a, b) =>
      a.hora_inicio.localeCompare(b.hora_inicio)
    ),
    lowOccupancyClasses,
    birthdayAlerts,
  };
}

export const getAdminDashboardHeavyData = cache(async function getAdminDashboardHeavyData(
  boxId?: string,
  locale = "es"
): Promise<AdminDashboardHeavyData> {
  try {
    const ctx = await loadDashboardContext(boxId);
    return await buildAdminDashboardHeavyData(ctx, locale);
  } catch (error) {
    console.error("[admin-dashboard] heavy section failed:", error);
    return { ...EMPTY_ADMIN_DASHBOARD_HEAVY, loadError: true };
  }
});

export async function getAdminDashboardData(
  boxId?: string,
  locale = "es"
): Promise<AdminDashboardData> {
  const [essential, heavy] = await Promise.all([
    getAdminDashboardEssentialData(boxId),
    getAdminDashboardHeavyData(boxId, locale),
  ]);
  return mergeDashboardParts(essential, heavy);
}
