import { cache } from "react";
import {
  computeAverageOccupancy,
  computeAvailableSpots,
  filterFullClasses,
  filterLowOccupancyClasses,
  partitionMembershipAlerts,
} from "@/lib/admin/dashboard-helpers";
import { getClasesByDateRange } from "@/lib/queries/clases";
import {
  computeAlertasMembresiaFromSocios,
  computeKpisFromSocios,
} from "@/lib/queries/memberships";
import { computeBirthdayAlertsFromSocios } from "@/lib/queries/birthdays";
import {
  loadBirthdayDeportivoForSocios,
  loadBoxSociosMembershipSnapshot,
  loadDashboardEssentialContext,
  loadTodayReservas,
} from "@/lib/queries/admin-dashboard-essential-loaders";
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

export const getAdminDashboardEssentialData = cache(
  async function getAdminDashboardEssentialData(
    boxId?: string
  ): Promise<AdminDashboardEssentialData> {
    const ctx = await loadDashboardEssentialContext(boxId);

    const [snapshot, todayClasses] = await Promise.all([
      loadBoxSociosMembershipSnapshot(ctx.resolvedBoxId),
      getClasesByDateRange(ctx.today, ctx.today, ctx.resolvedBoxId),
    ]);

    const socioIds = snapshot.socios.map((s) => s.id);
    const todayClassIds = todayClasses.map((c) => c.id);

    const [birthdayPerfiles, todayReservas] = await Promise.all([
      loadBirthdayDeportivoForSocios(socioIds),
      loadTodayReservas(todayClassIds),
    ]);

    const kpis = computeKpisFromSocios(
      snapshot.socios,
      snapshot.memMap,
      ctx.timezone
    );
    const alertas = computeAlertasMembresiaFromSocios(
      snapshot.socios,
      snapshot.memMap,
      ctx.timezone
    );
    const birthdayAlerts = computeBirthdayAlertsFromSocios(
      snapshot.socios,
      birthdayPerfiles,
      ctx.timezone
    );

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
    const availableSpotsToday = computeAvailableSpots(classesWithCupo);
    const membershipAlerts = partitionMembershipAlerts(alertas);
    const lowOccupancyClasses = filterLowOccupancyClasses(classesWithCupo);
    const fullClasses = filterFullClasses(classesWithCupo);

    const pendingPaymentAthletes = snapshot.socios
      .filter((s) => s.estado_cuenta === "pendiente_pago")
      .map((s) => ({
        id: s.id,
        nombre_completo: s.nombre_completo,
        telefono: s.telefono,
        foto_url: s.foto_url,
        estado_cuenta: s.estado_cuenta,
        created_at: s.created_at,
      }));

    return {
      today: ctx.today,
      boxName: ctx.boxName,
      executive: {
        classesToday: todayClasses.length,
        reservationsToday,
        attendanceToday,
        avgOccupancyToday,
        availableSpotsToday,
        expiringSoon: membershipAlerts.porVencer.length,
        expiredMemberships: membershipAlerts.vencidas.length,
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
      pendingPaymentAthletes,
      todayClasses: classesWithCupo.sort((a, b) =>
        a.hora_inicio.localeCompare(b.hora_inicio)
      ),
      lowOccupancyClasses,
      fullClasses,
      birthdayAlerts,
    };
  }
);

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
