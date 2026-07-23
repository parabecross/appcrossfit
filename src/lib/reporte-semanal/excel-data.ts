import { daysUntilDateOnly } from "@/lib/dates/date-only";
import { getSocioDisplayStatus } from "@/lib/membresias/helpers";
import { createdAtToDateOnly } from "./metrics";
import {
  buildLastAttendanceMap,
  countAttendances,
  countCancellations,
  countPrsInRange,
  countTotalReservations,
  countUniqueAthletesAttended,
  isClassHeld,
} from "./metrics";
import type { WeeklyReportMetrics, WeekRange } from "./types";
import type { WeeklyReportRawData } from "./fetch-data";

export type OccupancyIndicator =
  | "Alta ocupación"
  | "Ocupación media"
  | "Baja ocupación"
  | "Sin capacidad configurada";

export type ExcelClassRow = {
  fecha: string;
  hora: string;
  nombre: string;
  coach: string | null;
  estado: string;
  capacidad: number | null;
  reservas: number;
  asistencias: number;
  noAsistencias: number;
  cancelaciones: number;
  lugaresOcupados: number;
  ocupacionPct: number | null;
  indicador: OccupancyIndicator;
};

export type ExcelAthleteCategory =
  | "Más constante"
  | "Sin asistencia reciente"
  | "Nuevo atleta"
  | "Actividad normal";

export type ExcelAthleteRow = {
  atleta: string;
  categoria: ExcelAthleteCategory;
  asistencias: number;
  ultimaAsistencia: string | null;
  diasSinAsistir: number | null;
  fechaAlta: string;
  membresia: string | null;
  estadoMembresia: string;
};

export type ExcelMembershipCategory =
  | "Activa"
  | "Por vencer"
  | "Vencida"
  | "Cancelada";

export type ExcelMembershipRow = {
  atleta: string;
  membresia: string | null;
  estado: string;
  fechaInicio: string | null;
  fechaVencimiento: string | null;
  diasRestantes: number | null;
  categoria: ExcelMembershipCategory;
};

export type ExcelTrend =
  | "Mejoró"
  | "Disminuyó"
  | "Sin cambio"
  | "Sin datos comparables";

export type ExcelComparisonRow = {
  metrica: string;
  actual: number | null;
  anterior: number | null;
  diferencia: number | null;
  variacionPct: number | null;
  tendencia: ExcelTrend;
};

export function occupancyIndicator(
  ocupado: number,
  maximo: number
): OccupancyIndicator {
  if (maximo <= 0) return "Sin capacidad configurada";
  const pct = (ocupado / maximo) * 100;
  if (pct >= 70) return "Alta ocupación";
  if (pct >= 40) return "Ocupación media";
  return "Baja ocupación";
}

export function buildExcelClassRows(
  raw: WeeklyReportRawData
): ExcelClassRow[] {
  return raw.classesThisWeek
    .slice()
    .sort(
      (a, b) =>
        a.fecha.localeCompare(b.fecha) ||
        a.hora_inicio.localeCompare(b.hora_inicio)
    )
    .map((c) => {
      const reservas = raw.reservasThisWeek.filter((r) => r.clase_id === c.id);
      const reservasActivas = reservas.filter((r) =>
        ["confirmada", "asistio", "no_asistio"].includes(r.estado)
      ).length;
      const asistencias = reservas.filter((r) => r.estado === "asistio").length;
      const noAsistencias = reservas.filter(
        (r) => r.estado === "no_asistio"
      ).length;
      const cancelaciones = reservas.filter(
        (r) => r.estado === "cancelada"
      ).length;
      const ocupacionPct =
        c.cupo_maximo > 0 ? c.cupo_ocupado / c.cupo_maximo : null;
      return {
        fecha: c.fecha,
        hora: c.hora_inicio.slice(0, 5),
        nombre: c.nombre,
        coach: c.coach_nombre,
        estado: c.estado,
        capacidad: c.cupo_maximo > 0 ? c.cupo_maximo : null,
        reservas: reservasActivas,
        asistencias,
        noAsistencias,
        cancelaciones,
        lugaresOcupados: c.cupo_ocupado,
        ocupacionPct,
        indicador: occupancyIndicator(c.cupo_ocupado, c.cupo_maximo),
      };
    });
}

function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000
  );
}

export function buildExcelAthleteRows(
  raw: WeeklyReportRawData
): ExcelAthleteRow[] {
  const lastMap = buildLastAttendanceMap(raw.attendanceHistory);
  const attendancesByUser = new Map<string, number>();
  for (const r of raw.reservasThisWeek) {
    if (r.estado !== "asistio") continue;
    attendancesByUser.set(
      r.usuario_id,
      (attendancesByUser.get(r.usuario_id) ?? 0) + 1
    );
  }

  const newIds = new Set(
    raw.socios
      .filter((s) => {
        const day = createdAtToDateOnly(s.created_at, raw.timezone);
        return day >= raw.week.from && day <= raw.week.to;
      })
      .map((s) => s.id)
  );

  const topConstantCutoff = Math.max(
    1,
    ...[...attendancesByUser.values()]
  );
  const constantIds = new Set(
    [...attendancesByUser.entries()]
      .filter(([, n]) => n >= Math.max(2, Math.ceil(topConstantCutoff * 0.5)))
      .map(([id]) => id)
  );

  const rows: ExcelAthleteRow[] = raw.socios.map((s) => {
    const m = raw.membershipByUser.get(s.id) ?? null;
    const display = getSocioDisplayStatus(s, m, raw.timezone);
    const last = lastMap.get(s.id) ?? null;
    const asistencias = attendancesByUser.get(s.id) ?? 0;
    let categoria: ExcelAthleteCategory = "Actividad normal";
    if (last && daysBetween(last, raw.today) >= 10) {
      const activeLike = display === "activo" || display === "por_vencer";
      if (activeLike) categoria = "Sin asistencia reciente";
    }
    if (categoria === "Actividad normal" && newIds.has(s.id)) {
      categoria = "Nuevo atleta";
    }
    if (
      categoria === "Actividad normal" &&
      constantIds.has(s.id) &&
      asistencias >= 2
    ) {
      categoria = "Más constante";
    }

    return {
      atleta: s.nombre_completo,
      categoria,
      asistencias,
      ultimaAsistencia: last,
      diasSinAsistir: last ? daysBetween(last, raw.today) : null,
      fechaAlta: createdAtToDateOnly(s.created_at, raw.timezone),
      membresia: m?.plan_nombre ?? null,
      estadoMembresia: display,
    };
  });

  const order: Record<ExcelAthleteCategory, number> = {
    "Sin asistencia reciente": 0,
    "Nuevo atleta": 1,
    "Más constante": 2,
    "Actividad normal": 3,
  };

  return rows.sort((a, b) => {
    const oc = order[a.categoria] - order[b.categoria];
    if (oc !== 0) return oc;
    if (a.categoria === "Sin asistencia reciente") {
      return (b.diasSinAsistir ?? 0) - (a.diasSinAsistir ?? 0);
    }
    if (a.categoria === "Más constante") {
      return b.asistencias - a.asistencias;
    }
    return a.atleta.localeCompare(b.atleta);
  });
}

export function buildExcelMembershipRows(
  raw: WeeklyReportRawData
): ExcelMembershipRow[] {
  const rows: ExcelMembershipRow[] = [];
  for (const s of raw.socios) {
    const m = raw.membershipByUser.get(s.id);
    if (!m) continue;
    const display = getSocioDisplayStatus(s, m, raw.timezone);
    let categoria: ExcelMembershipCategory;
    if (m.estado === "cancelada") categoria = "Cancelada";
    else if (display === "por_vencer") categoria = "Por vencer";
    else if (display === "vencida" || m.estado === "vencida")
      categoria = "Vencida";
    else if (display === "activo") categoria = "Activa";
    else if (m.estado === "vigente") categoria = "Activa";
    else categoria = "Vencida";

    const dias =
      categoria === "Cancelada"
        ? null
        : daysUntilDateOnly(m.fecha_fin, raw.today);

    rows.push({
      atleta: s.nombre_completo,
      membresia: m.plan_nombre,
      estado: m.estado,
      fechaInicio: m.fecha_inicio,
      fechaVencimiento: m.fecha_fin,
      diasRestantes: dias,
      categoria,
    });
  }

  const order: Record<ExcelMembershipCategory, number> = {
    "Por vencer": 0,
    Vencida: 1,
    Activa: 2,
    Cancelada: 3,
  };
  return rows.sort(
    (a, b) =>
      order[a.categoria] - order[b.categoria] ||
      a.atleta.localeCompare(b.atleta)
  );
}

function trendForMetric(
  key:
    | "uniqueAthletesAttended"
    | "classesHeld"
    | "totalReservations"
    | "totalAttendances"
    | "totalCancellations"
    | "avgOccupancyPct"
    | "newAthletes"
    | "prsRegistered",
  current: number | null,
  previous: number | null
): { diferencia: number | null; variacionPct: number | null; tendencia: ExcelTrend } {
  if (current === null || previous === null) {
    return {
      diferencia: null,
      variacionPct: null,
      tendencia: "Sin datos comparables",
    };
  }
  const diferencia = current - previous;
  let variacionPct: number | null = null;
  if (previous === 0 && current === 0) {
    return { diferencia: 0, variacionPct: 0, tendencia: "Sin cambio" };
  }
  if (previous === 0 && current > 0) {
    return {
      diferencia,
      variacionPct: null,
      tendencia: "Sin datos comparables",
    };
  }
  if (diferencia === 0) {
    return { diferencia: 0, variacionPct: 0, tendencia: "Sin cambio" };
  }
  variacionPct = Math.round((diferencia / previous) * 1000) / 10;

  const higherIsBetter =
    key !== "totalCancellations";

  if (higherIsBetter) {
    return {
      diferencia,
      variacionPct,
      tendencia: diferencia > 0 ? "Mejoró" : "Disminuyó",
    };
  }
  return {
    diferencia,
    variacionPct,
    tendencia: diferencia < 0 ? "Mejoró" : "Disminuyó",
  };
}

export function buildExcelComparisonRows(
  raw: WeeklyReportRawData,
  metrics: WeeklyReportMetrics
): ExcelComparisonRow[] {
  const classesHeldPrev = raw.classesPrevWeek.filter((c) =>
    isClassHeld(c, raw.previousWeek, raw.timezone, raw.today)
  ).length;
  const prsPrev = countPrsInRange(raw.prsPrevWeek, raw.previousWeek);
  const uniquePrev = countUniqueAthletesAttended(raw.reservasPrevWeek);
  const reservasPrev = countTotalReservations(raw.reservasPrevWeek);
  const asistPrev = countAttendances(raw.reservasPrevWeek);
  const cancelPrev = countCancellations(raw.reservasPrevWeek);

  const pairs: Array<{
    key: Parameters<typeof trendForMetric>[0];
    metrica: string;
    actual: number | null;
    anterior: number | null;
  }> = [
    {
      key: "uniqueAthletesAttended",
      metrica: "Atletas únicos con asistencia",
      actual: metrics.uniqueAthletesAttended,
      anterior: uniquePrev,
    },
    {
      key: "classesHeld",
      metrica: "Clases impartidas",
      actual: metrics.classesHeld,
      anterior: classesHeldPrev,
    },
    {
      key: "totalReservations",
      metrica: "Reservas",
      actual: metrics.totalReservations,
      anterior: reservasPrev,
    },
    {
      key: "totalAttendances",
      metrica: "Asistencias",
      actual: metrics.totalAttendances,
      anterior: asistPrev,
    },
    {
      key: "totalCancellations",
      metrica: "Cancelaciones",
      actual: metrics.totalCancellations,
      anterior: cancelPrev,
    },
    {
      key: "avgOccupancyPct",
      metrica: "Ocupación promedio",
      actual: metrics.avgOccupancyPct,
      anterior:
        metrics.comparison.avgOccupancyPct.label === "sin_datos"
          ? null
          : metrics.comparison.avgOccupancyPct.previous,
    },
    {
      key: "newAthletes",
      metrica: "Nuevos atletas",
      actual: metrics.newAthletes,
      anterior: metrics.comparison.newAthletes.previous,
    },
    {
      key: "prsRegistered",
      metrica: "PRs",
      actual: metrics.prsRegistered,
      anterior: prsPrev,
    },
  ];

  return pairs.map((p) => {
    const t = trendForMetric(p.key, p.actual, p.anterior);
    return {
      metrica: p.metrica,
      actual: p.actual,
      anterior: p.anterior,
      diferencia: t.diferencia,
      variacionPct: t.variacionPct === null ? null : t.variacionPct / 100,
      tendencia: t.tendencia,
    };
  });
}

export function buildExcelAlerts(
  raw: WeeklyReportRawData,
  metrics: WeeklyReportMetrics,
  classRows: ExcelClassRow[]
): string[] {
  const alerts: string[] = [];
  if (metrics.inactiveAthletes.length > 0) {
    alerts.push(
      `${metrics.inactiveAthletes.length} atletas activos con 10 o más días sin asistir`
    );
  }
  if (metrics.membershipsExpiringSoon > 0) {
    alerts.push(
      `${metrics.membershipsExpiringSoon} membresías próximas a vencer`
    );
  }
  const low = classRows.filter((c) => c.indicador === "Baja ocupación");
  if (low.length > 0) {
    alerts.push(`${low.length} clases con baja ocupación`);
  }
  if (metrics.totalCancellations >= 5) {
    alerts.push(
      `${metrics.totalCancellations} cancelaciones en el periodo (revisar demanda)`
    );
  }
  return alerts;
}

export type ExcelWorkbookModel = {
  boxName: string;
  boxId: string;
  timezone: string;
  week: WeekRange;
  previousWeek: WeekRange;
  weekLabel: string;
  previousWeekLabel: string;
  generatedAtLabel: string;
  metrics: WeeklyReportMetrics;
  classRows: ExcelClassRow[];
  athleteRows: ExcelAthleteRow[];
  membershipRows: ExcelMembershipRow[];
  comparisonRows: ExcelComparisonRow[];
  alerts: string[];
};

export function buildExcelWorkbookModel(
  raw: WeeklyReportRawData,
  metrics: WeeklyReportMetrics,
  labels: { weekLabel: string; previousWeekLabel: string; generatedAtLabel: string }
): ExcelWorkbookModel {
  const classRows = buildExcelClassRows(raw);
  return {
    boxName: raw.boxName,
    boxId: raw.boxId,
    timezone: raw.timezone,
    week: raw.week,
    previousWeek: raw.previousWeek,
    weekLabel: labels.weekLabel,
    previousWeekLabel: labels.previousWeekLabel,
    generatedAtLabel: labels.generatedAtLabel,
    metrics,
    classRows,
    athleteRows: buildExcelAthleteRows(raw),
    membershipRows: buildExcelMembershipRows(raw),
    comparisonRows: buildExcelComparisonRows(raw, metrics),
    alerts: buildExcelAlerts(raw, metrics, classRows),
  };
}
