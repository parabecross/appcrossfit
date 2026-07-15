import { createClient } from "@/lib/supabase/server";
import {
  computeWeeklySummary,
  findAthletesWithoutWeekBooking,
  findInactiveAthletes,
  mergeActivityEvents,
  type DashboardActivityEvent,
  type WeeklySummaryData,
} from "@/lib/admin/dashboard-helpers";
import {
  computeDemandStats,
  computeTrendStats,
  getStatsData,
} from "@/lib/queries/stats";
import type { AdminDashboardHeavyData } from "@/lib/queries/admin-dashboard-types";
import type { DashboardContext } from "@/lib/queries/admin-dashboard-context";

const EMPTY_WEEKLY_SUMMARY: WeeklySummaryData = {
  attendanceThisWeek: 0,
  attendanceLastWeek: 0,
  attendanceDelta: 0,
  topClassName: null,
  topClassBookings: 0,
  lowClassName: null,
  lowClassBookings: 0,
  avgOccupancyThisWeek: null,
  prsThisWeek: 0,
  goalsCompleted: 0,
  membershipsRenewed: 0,
};

export const EMPTY_ADMIN_DASHBOARD_HEAVY: AdminDashboardHeavyData = {
  inactiveAthletesHigh: [],
  athletesWithoutWeekBooking: [],
  weeklySummary: EMPTY_WEEKLY_SUMMARY,
  recentPrs: [],
  recentSkills: [],
  topConsistentAthletes: [],
  charts: { demand: [], trend: [] },
  recentActivity: [],
  inactiveAthletesCount: 0,
  recentPrsCount: 0,
  attendanceRate: null,
  loadError: false,
};

export async function buildAdminDashboardHeavyData(
  ctx: DashboardContext,
  locale: string
): Promise<AdminDashboardHeavyData> {
  const supabase = await createClient();
  const statsRaw = await getStatsData(ctx.resolvedBoxId);
  const {
    today,
    weekRange,
    prevWeekRange,
    socioIds,
    activeSocioIds,
    nombreMap,
    activeSocios,
  } = ctx;

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

  const telefonoMap = new Map(
    ctx.socios.map((s) => [s.id, s.telefono ?? null])
  );
  const fotoMap = new Map(ctx.socios.map((s) => [s.id, s.foto_url ?? null]));
  const createdMap = new Map(
    ctx.socios.map((s) => [s.id, s.created_at ?? null])
  );

  const athletesWithoutWeekBooking = findAthletesWithoutWeekBooking(
    activeSocioIds,
    bookedThisWeek
  ).map((id) => ({
    id,
    nombre: nombreMap.get(id) ?? "—",
    telefono: telefonoMap.get(id) ?? null,
    fotoUrl: fotoMap.get(id) ?? null,
    created_at: createdMap.get(id) ?? null,
  }));

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

  let recentPrs: AdminDashboardHeavyData["recentPrs"] = [];
  const recentSkills: AdminDashboardHeavyData["recentSkills"] = [];
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
    inactiveAthletesHigh,
    athletesWithoutWeekBooking,
    weeklySummary,
    recentPrs: recentPrs.slice(0, 5),
    recentSkills: recentSkills.slice(0, 5),
    topConsistentAthletes: [],
    charts: { demand, trend },
    recentActivity,
    inactiveAthletesCount: inactiveAthletes.length,
    recentPrsCount,
    attendanceRate,
    loadError: false,
  };
}
