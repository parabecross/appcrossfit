import { createAdminClient } from "@/lib/supabase/admin";
import { getBoxConfig } from "@/lib/box/get-box-config";
import { addDaysToDateString } from "@/lib/dates/date-only";
import type {
  ReportClassRow,
  ReportMembershipRow,
  ReportPrRow,
  ReportReservaRow,
  ReportSocioRow,
  WeekRange,
} from "./types";
import {
  getTodayInBox,
  previousWeekFromRange,
  weekRangeQueryBounds,
} from "./week-range";

export type WeeklyReportRawData = {
  boxId: string;
  boxName: string;
  timezone: string;
  logoUrl: string | null;
  today: string;
  week: WeekRange;
  previousWeek: WeekRange;
  classesThisWeek: ReportClassRow[];
  classesPrevWeek: ReportClassRow[];
  reservasThisWeek: ReportReservaRow[];
  reservasPrevWeek: ReportReservaRow[];
  attendanceHistory: ReportReservaRow[];
  socios: ReportSocioRow[];
  membershipByUser: Map<string, ReportMembershipRow>;
  prs: ReportPrRow[];
};

/**
 * Carga de solo lectura, aislada por boxId (debe venir de la sesión autenticada).
 * Usa service role únicamente después de que el caller validó rol + box.
 * `week` debe estar ya validada (lunes–domingo en TZ del box).
 */
export async function fetchWeeklyReportData(
  boxId: string,
  week: WeekRange
): Promise<WeeklyReportRawData> {
  if (!boxId) {
    throw new Error("box_id requerido");
  }

  const box = await getBoxConfig(boxId);
  const timezone = box.timezone;
  const today = getTodayInBox(timezone);
  const previousWeek = previousWeekFromRange(week);
  const weekBounds = weekRangeQueryBounds(week);
  const prevBounds = weekRangeQueryBounds(previousWeek);

  const admin = createAdminClient();

  const [{ data: clasesRows }, { data: socioRows }] = await Promise.all([
    admin
      .from("clases")
      .select(
        "id, nombre, fecha, hora_inicio, hora_fin, cupo_maximo, estado, box_id"
      )
      .eq("box_id", boxId)
      .gte("fecha", prevBounds.fromInclusive)
      .lte("fecha", weekBounds.toInclusive)
      .order("fecha")
      .order("hora_inicio"),
    admin
      .from("profiles")
      .select("id, nombre_completo, estado_cuenta, created_at, box_id, rol")
      .eq("box_id", boxId)
      .eq("rol", "socio"),
  ]);

  const clases = (clasesRows ?? []).filter((c) => c.box_id === boxId);
  const socios: ReportSocioRow[] = (socioRows ?? [])
    .filter((s) => s.box_id === boxId && s.rol === "socio")
    .map((s) => ({
      id: s.id,
      nombre_completo: s.nombre_completo,
      estado_cuenta: s.estado_cuenta,
      created_at: s.created_at,
    }));

  const claseIds = clases.map((c) => c.id);
  let cupoMap = new Map<string, number>();
  if (claseIds.length > 0) {
    const { data: cupoRows } = await admin.rpc("clases_cupo_ocupado", {
      p_clase_ids: claseIds,
    });
    cupoMap = new Map(
      (cupoRows ?? []).map((row: { clase_id: string; ocupado: number }) => [
        row.clase_id,
        Number(row.ocupado),
      ])
    );
  }

  const toClassRow = (c: (typeof clases)[number]): ReportClassRow => ({
    id: c.id,
    nombre: c.nombre,
    fecha: c.fecha,
    hora_inicio: c.hora_inicio,
    hora_fin: c.hora_fin,
    cupo_maximo: c.cupo_maximo,
    cupo_ocupado: cupoMap.get(c.id) ?? 0,
    estado: c.estado,
  });

  const classesThisWeek = clases
    .filter((c) => c.fecha >= week.from && c.fecha <= week.to)
    .map(toClassRow);
  const classesPrevWeek = clases
    .filter((c) => c.fecha >= previousWeek.from && c.fecha <= previousWeek.to)
    .map(toClassRow);

  const inactiveLookbackFrom = addDaysToDateString(today, -90);

  const socioIds = socios.map((s) => s.id);

  const [{ data: reservaRows }, { data: membRows }, { data: prRows }] =
    await Promise.all([
      claseIds.length === 0
        ? Promise.resolve({ data: [] as never[] })
        : admin
            .from("reservas")
            .select("id, usuario_id, clase_id, estado, clase:clases!inner(fecha, box_id)")
            .in("clase_id", claseIds),
      socioIds.length === 0
        ? Promise.resolve({ data: [] as never[] })
        : admin
            .from("membresias")
            .select("usuario_id, estado, fecha_fin")
            .in("usuario_id", socioIds)
            .in("estado", ["vigente", "vencida"])
            .order("fecha_fin", { ascending: false }),
      socioIds.length === 0
        ? Promise.resolve({ data: [] as never[] })
        : admin
            .from("atleta_pr_marcas")
            .select("usuario_id, fecha")
            .in("usuario_id", socioIds)
            .gte("fecha", week.from)
            .lte("fecha", week.to),
    ]);

  // Historial de asistencias para inactividad (últimos 90 días, solo asistio).
  const { data: historyRows } =
    socioIds.length === 0
      ? { data: [] as never[] }
      : await admin
          .from("reservas")
          .select(
            "id, usuario_id, clase_id, estado, clase:clases!inner(fecha, box_id)"
          )
          .in("usuario_id", socioIds)
          .eq("estado", "asistio")
          .gte("clase.fecha", inactiveLookbackFrom)
          .lte("clase.fecha", today)
          .eq("clase.box_id", boxId);

  const normalizeReserva = (row: {
    id: string;
    usuario_id: string;
    clase_id: string;
    estado: ReportReservaRow["estado"];
    clase: { fecha: string; box_id: string } | { fecha: string; box_id: string }[] | null;
  }): ReportReservaRow | null => {
    const clase = Array.isArray(row.clase) ? row.clase[0] : row.clase;
    if (!clase || clase.box_id !== boxId) return null;
    return {
      id: row.id,
      usuario_id: row.usuario_id,
      clase_id: row.clase_id,
      estado: row.estado,
      claseFecha: clase.fecha,
    };
  };

  const allWeekReservas = (reservaRows ?? [])
    .map((r) =>
      normalizeReserva(
        r as Parameters<typeof normalizeReserva>[0]
      )
    )
    .filter((r): r is ReportReservaRow => r !== null);

  const reservasThisWeek = allWeekReservas.filter(
    (r) => r.claseFecha >= week.from && r.claseFecha <= week.to
  );
  const reservasPrevWeek = allWeekReservas.filter(
    (r) =>
      r.claseFecha >= previousWeek.from && r.claseFecha <= previousWeek.to
  );

  const attendanceHistory = (historyRows ?? [])
    .map((r) =>
      normalizeReserva(r as Parameters<typeof normalizeReserva>[0])
    )
    .filter((r): r is ReportReservaRow => r !== null);

  const membershipByUser = new Map<string, ReportMembershipRow>();
  for (const m of membRows ?? []) {
    if (!membershipByUser.has(m.usuario_id)) {
      membershipByUser.set(m.usuario_id, {
        usuario_id: m.usuario_id,
        estado: m.estado,
        fecha_fin: m.fecha_fin,
      });
    }
  }

  const prs: ReportPrRow[] = (prRows ?? []).map((p) => ({
    usuario_id: p.usuario_id,
    fecha: p.fecha,
  }));

  return {
    boxId,
    boxName: box.name,
    timezone,
    logoUrl: box.logoUrl,
    today,
    week,
    previousWeek,
    classesThisWeek,
    classesPrevWeek,
    reservasThisWeek,
    reservasPrevWeek,
    attendanceHistory,
    socios,
    membershipByUser,
    prs,
  };
}
