import { createClient } from "@/lib/supabase/server";
import { getBoxConfig } from "@/lib/box/config";
import {
  computeAverageOccupancy,
  computeWeeklySummary,
  findAthletesWithoutWeekBooking,
  findInactiveAthletes,
  getPreviousWeekRange,
  getWeekRangeInTimezone,
  mergeActivityEvents,
  partitionMembershipAlerts,
  type DashboardActivityEvent,
  type InactiveAthleteAlert,
  type WeeklySummaryData,
} from "@/lib/admin/dashboard-helpers";
import { todayInTimezone } from "@/lib/dates/date-only";
import { getClasesByDateRange } from "@/lib/queries/clases";
import {
  getAlertasMembresia,
  getKpis,
  getMembresiasMapForUsuarios,
} from "@/lib/queries/memberships";
import { resolveQueryBoxId } from "@/lib/queries/box-scope";
import { getSocioDisplayStatus } from "@/lib/membresias/helpers";
import {
  computeDemandStats,
  computeTrendStats,
  getStatsData,
} from "@/lib/queries/stats";
import type { AlertaMembresia, Clase } from "@/types/database";

export interface AdminDashboardTodayClass extends Clase {
  cupo_ocupado: number;
}

export interface AdminDashboardData {
  today: string;
  boxName: string;
  executive: {
    classesToday: number;
    reservationsToday: number;
    attendanceToday: number;
    avgOccupancyToday: number;
    expiringSoon: number;
    pendingPayment: number;
    recentPrsCount: number;
    inactiveAthletesCount: number;
  };
  boxStatus: {
    activeMembers: number;
    totalMembers: number;
    expired: number;
    expiringSoon: number;
    avgOccupancyToday: number;
    attendanceToday: number;
    attendanceRate: number | null;
  };
  kpis: Awaited<ReturnType<typeof getKpis>>;
  alertas: AlertaMembresia[];
  membershipAlerts: ReturnType<typeof partitionMembershipAlerts>;
  todayClasses: AdminDashboardTodayClass[];
  inactiveAthletesHigh: InactiveAthleteAlert[];
  athletesWithoutWeekBooking: { id: string; nombre: string }[];
  lowOccupancyClasses: AdminDashboardTodayClass[];
  recentActivity: DashboardActivityEvent[];
  weeklySummary: WeeklySummaryData;
  recentPrs: Array<{
    id: string;
    ejercicio: string;
    valor: number;
    unidad: string;
    nombre: string;
    fecha: string;
  }>;
  recentSkills: Array<{
    id: string;
    skill: string;
    estado: string;
    nombre: string;
    at: string;
  }>;
  topConsistentAthletes: Array<{ name: string; frequency: number }>;
  charts: {
    demand: ReturnType<typeof computeDemandStats>;
    trend: ReturnType<typeof computeTrendStats>;
  };
}

async function getSocioProfiles(boxId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, nombre_completo, estado_cuenta")
    .eq("box_id", boxId)
    .eq("rol", "socio")
    .order("nombre_completo");
  return data ?? [];
}

export async function getAdminDashboardData(
  boxId?: string,
  locale = "es"
): Promise<AdminDashboardData> {
  const resolvedBoxId = await resolveQueryBoxId(boxId);
  const boxConfig = await getBoxConfig(resolvedBoxId);
  const today = todayInTimezone(boxConfig.timezone);
  const weekRange = getWeekRangeInTimezone(boxConfig.timezone);
  const prevWeekRange = getPreviousWeekRange(boxConfig.timezone);
  const supabase = await createClient();

  const [kpis, alertas, statsRaw, todayClasses, socios] = await Promise.all([
    getKpis(resolvedBoxId),
    getAlertasMembresia(resolvedBoxId),
    getStatsData(resolvedBoxId),
    getClasesByDateRange(today, today, resolvedBoxId),
    getSocioProfiles(resolvedBoxId),
  ]);

  const socioIds = socios.map((s) => s.id);
  const todayClassIds = todayClasses.map((c) => c.id);

  const memMap = await getMembresiasMapForUsuarios(socioIds);
  const activeSocioIds = socios
    .filter((s) => {
      const mem = memMap.get(s.id) ?? null;
      const status = getSocioDisplayStatus(s, mem, boxConfig.timezone);
      return status === "activo" || status === "por_vencer";
    })
    .map((s) => s.id);

  const nombreMap = new Map(socios.map((s) => [s.id, s.nombre_completo]));

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

  const recentReservas = statsRaw.reservas.filter((r) => {
    const created = new Date(r.created_at);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    return created >= cutoff;
  });

  const lastAttendanceByUser = new Map<string, string>();
  for (const r of statsRaw.reservas) {
    if (r.estado !== "asistio" || !r.clase?.fecha) continue;
    const uid = (r as { usuario_id?: string }).usuario_id;
    if (!uid) continue;
    const prev = lastAttendanceByUser.get(uid);
    if (!prev || r.clase.fecha > prev) {
      lastAttendanceByUser.set(uid, r.clase.fecha);
    }
  }

  const activeSocios = socios.filter((s) => activeSocioIds.includes(s.id));
  const inactiveAthletes = findInactiveAthletes(
    activeSocios,
    lastAttendanceByUser,
    today
  );
  const inactiveAthletesHigh = findInactiveAthletes(
    activeSocios,
    lastAttendanceByUser,
    today,
    10
  );

  const bookedThisWeek = new Set<string>();
  for (const r of statsRaw.reservas) {
    if (!r.clase?.fecha) continue;
    if (r.clase.fecha < weekRange.from || r.clase.fecha > weekRange.to) continue;
    if (!["confirmada", "asistio"].includes(r.estado)) continue;
    const uid = (r as { usuario_id?: string }).usuario_id;
    if (uid) bookedThisWeek.add(uid);
  }

  const withoutBookingIds = findAthletesWithoutWeekBooking(
    activeSocioIds,
    bookedThisWeek
  );
  const athletesWithoutWeekBooking = withoutBookingIds
    .map((id) => ({
      id,
      nombre: nombreMap.get(id) ?? "—",
    }))
    .slice(0, 12);

  const lowOccupancyClasses = classesWithCupo.filter((c) => {
    if (c.cupo_maximo <= 0) return false;
    const pct = (c.cupo_ocupado / c.cupo_maximo) * 100;
    return pct < 40 && pct >= 0;
  });

  const activityEvents: DashboardActivityEvent[] = [];

  for (const r of recentReservas) {
    if (r.estado !== "confirmada") continue;
    const profile = r.profile as { nombre_completo?: string } | null;
    const clase = r.clase as { nombre?: string } | null;
    activityEvents.push({
      id: `res-${r.id}`,
      type: "reserva",
      at: r.created_at,
      title: profile?.nombre_completo ?? "—",
      subtitle: clase?.nombre,
    });
  }

  for (const r of statsRaw.reservas) {
    if (r.estado !== "asistio" || !r.clase?.fecha) continue;
    const profile = r.profile as { nombre_completo?: string } | null;
    const clase = r.clase as { nombre?: string; fecha?: string } | null;
    activityEvents.push({
      id: `att-${r.id}`,
      type: "asistencia",
      at: `${clase?.fecha ?? today}T12:00:00.000Z`,
      title: profile?.nombre_completo ?? "—",
      subtitle: clase?.nombre,
    });
  }

  let recentPrs: AdminDashboardData["recentPrs"] = [];
  const recentSkills: AdminDashboardData["recentSkills"] = [];
  let prsThisWeek = 0;
  let recentPrsCount = 0;
  let goalsCompleted = 0;
  let membershipsRenewed = 0;

  const weekStartIso = `${weekRange.from}T00:00:00.000Z`;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  if (socioIds.length > 0) {
    const [{ data: prs }, { data: skillHist }, { data: membresiasWeek }] =
      await Promise.all([
        supabase
          .from("atleta_pr_marcas")
          .select("id, ejercicio, valor, unidad, fecha, created_at, usuario_id")
          .in("usuario_id", socioIds)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("atleta_skill_historial")
          .select(
            "id, estado_nuevo, created_at, usuario_id, skill_id, atleta_skills(skill)"
          )
          .in("usuario_id", socioIds)
          .in("estado_nuevo", ["logrado", "dominado"])
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("membresias")
          .select("id, created_at, usuario_id")
          .in("usuario_id", socioIds)
          .gte("created_at", weekStartIso),
      ]);

    recentPrs = (prs ?? []).map((p) => ({
      id: p.id,
      ejercicio: p.ejercicio,
      valor: Number(p.valor),
      unidad: p.unidad,
      nombre: nombreMap.get(p.usuario_id) ?? "—",
      fecha: p.fecha,
    }));

    prsThisWeek = (prs ?? []).filter(
      (p) => p.created_at >= weekStartIso
    ).length;
    recentPrsCount = (prs ?? []).filter(
      (p) => new Date(p.created_at) >= sevenDaysAgo
    ).length;

    membershipsRenewed = membresiasWeek?.length ?? 0;

    const { data: goals } = await supabase
      .from("atleta_objetivos")
      .select("id")
      .in("usuario_id", socioIds)
      .eq("estado", "completado")
      .gte("updated_at", weekStartIso);

    goalsCompleted = goals?.length ?? 0;

    for (const h of skillHist ?? []) {
      const skillRow = h.atleta_skills as { skill?: string } | null;
      const skillKey = skillRow?.skill ?? "skill";
      activityEvents.push({
        id: `skill-${h.id}`,
        type: "skill",
        at: h.created_at,
        title: nombreMap.get(h.usuario_id) ?? "—",
        subtitle: skillKey,
      });
      recentSkills.push({
        id: h.id,
        skill: skillKey,
        estado: h.estado_nuevo,
        nombre: nombreMap.get(h.usuario_id) ?? "—",
        at: h.created_at,
      });
    }

    for (const p of prs ?? []) {
      activityEvents.push({
        id: `pr-${p.id}`,
        type: "pr",
        at: p.created_at,
        title: nombreMap.get(p.usuario_id) ?? "—",
        subtitle: p.ejercicio,
      });
    }

    const { data: membresiasRecientes } = await supabase
      .from("membresias")
      .select("id, created_at, usuario_id, plan:planes(nombre)")
      .in("usuario_id", socioIds)
      .order("created_at", { ascending: false })
      .limit(8);

    for (const m of membresiasRecientes ?? []) {
      const plan = m.plan as { nombre?: string } | null;
      activityEvents.push({
        id: `mem-${m.id}`,
        type: "membresia",
        at: m.created_at,
        title: nombreMap.get(m.usuario_id) ?? "—",
        subtitle: plan?.nombre,
      });
    }
  }

  const recentAttendance = statsRaw.reservas.filter((r) =>
    ["asistio", "no_asistio"].includes(r.estado)
  );
  const asistioCount = recentAttendance.filter(
    (r) => r.estado === "asistio"
  ).length;
  const attendanceRate =
    recentAttendance.length > 0
      ? Math.round((asistioCount / recentAttendance.length) * 100)
      : null;

  const weeklySummary = computeWeeklySummary(
    statsRaw.reservas.map((r) => ({
      estado: r.estado,
      clase_id: (r as { clase_id?: string }).clase_id,
      clase: r.clase,
    })),
    weekRange.from,
    weekRange.to,
    prevWeekRange.from,
    prevWeekRange.to,
    prsThisWeek,
    goalsCompleted,
    membershipsRenewed
  );

  const demand = computeDemandStats(statsRaw.reservas, locale);
  const trend = computeTrendStats(statsRaw.reservas);

  const recentActivity = mergeActivityEvents(activityEvents, {
    today,
    maxDays: 7,
    limit: 80,
  });

  return {
    today,
    boxName: boxConfig.name,
    executive: {
      classesToday: todayClasses.length,
      reservationsToday,
      attendanceToday,
      avgOccupancyToday,
      expiringSoon: membershipAlerts.porVencer.length,
      pendingPayment: kpis.pendientes,
      recentPrsCount,
      inactiveAthletesCount: inactiveAthletes.length,
    },
    boxStatus: {
      activeMembers: kpis.activos,
      totalMembers: kpis.total,
      expired: kpis.vencidos,
      expiringSoon: membershipAlerts.porVencer.length,
      avgOccupancyToday,
      attendanceToday,
      attendanceRate,
    },
    kpis,
    alertas,
    membershipAlerts,
    todayClasses: classesWithCupo.sort((a, b) =>
      a.hora_inicio.localeCompare(b.hora_inicio)
    ),
    inactiveAthletesHigh: inactiveAthletesHigh.slice(0, 8),
    athletesWithoutWeekBooking,
    lowOccupancyClasses,
    recentActivity,
    weeklySummary,
    recentPrs: recentPrs.slice(0, 5),
    recentSkills: recentSkills.slice(0, 5),
    topConsistentAthletes: [],
    charts: { demand, trend },
  };
}
