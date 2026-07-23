import { hasClassEnded } from "@/lib/clases/helpers";
import { computeAverageOccupancy } from "@/lib/admin/dashboard-helpers";
import { findInactiveAthletes } from "@/lib/admin/dashboard-helpers";
import {
  getSocioDisplayStatus,
  type SocioDisplayStatus,
} from "@/lib/membresias/helpers";
import { compareMetric, compareNullableMetric } from "./compare";
import { buildWeeklyNarrative } from "./narrative";
import type {
  AthleteConstancyRow,
  AthleteInactiveRow,
  AthleteNameRow,
  ClassOccupancyRow,
  ReportClassRow,
  ReportMembershipRow,
  ReportPrRow,
  ReportReservaRow,
  ReportSocioRow,
  WeeklyReportMetrics,
  WeekRange,
} from "./types";

const BOOKING_ESTADOS = new Set(["confirmada", "asistio", "no_asistio"]);

/**
 * Clase impartida: programada, fecha en el rango, y ya terminó en la TZ del box.
 * No cuenta canceladas ni futuras.
 */
export function isClassHeld(
  clase: Pick<ReportClassRow, "estado" | "fecha" | "hora_fin">,
  range: WeekRange,
  timeZone: string,
  nowFecha?: string
): boolean {
  if (clase.estado !== "programada") return false;
  if (clase.fecha < range.from || clase.fecha > range.to) return false;
  if (nowFecha && clase.fecha > nowFecha) return false;
  return hasClassEnded(clase.fecha, clase.hora_fin, timeZone);
}

export function filterReservasInRange(
  reservas: ReportReservaRow[],
  range: WeekRange
): ReportReservaRow[] {
  return reservas.filter(
    (r) => r.claseFecha >= range.from && r.claseFecha <= range.to
  );
}

export function countUniqueAthletesAttended(
  reservas: ReportReservaRow[]
): number {
  const ids = new Set<string>();
  for (const r of reservas) {
    if (r.estado === "asistio") ids.add(r.usuario_id);
  }
  return ids.size;
}

export function countTotalReservations(reservas: ReportReservaRow[]): number {
  return reservas.filter((r) => BOOKING_ESTADOS.has(r.estado)).length;
}

export function countAttendances(reservas: ReportReservaRow[]): number {
  return reservas.filter((r) => r.estado === "asistio").length;
}

export function countCancellations(reservas: ReportReservaRow[]): number {
  return reservas.filter((r) => r.estado === "cancelada").length;
}

export function occupancyPct(
  ocupado: number,
  maximo: number
): number | null {
  if (maximo <= 0) return null;
  return Math.round((ocupado / maximo) * 100);
}

function classLabel(c: ReportClassRow): string {
  const time = c.hora_inicio.slice(0, 5);
  return `${c.nombre} · ${c.fecha} ${time}`;
}

export function buildClassOccupancyRows(
  classes: ReportClassRow[],
  reservas: ReportReservaRow[]
): ClassOccupancyRow[] {
  return classes
    .filter((c) => c.estado === "programada")
    .map((c) => {
      const classReservas = reservas.filter((r) => r.clase_id === c.id);
      return {
        id: c.id,
        label: classLabel(c),
        fecha: c.fecha,
        horaInicio: c.hora_inicio.slice(0, 5),
        cupoOcupado: c.cupo_ocupado,
        cupoMaximo: c.cupo_maximo,
        occupancyPct: occupancyPct(c.cupo_ocupado, c.cupo_maximo),
        cancellations: classReservas.filter((r) => r.estado === "cancelada")
          .length,
        attendances: classReservas.filter((r) => r.estado === "asistio")
          .length,
      };
    });
}

export function rankTopOccupied(
  rows: ClassOccupancyRow[],
  limit = 5
): ClassOccupancyRow[] {
  return [...rows]
    .filter((r) => r.occupancyPct !== null)
    .sort((a, b) => (b.occupancyPct ?? 0) - (a.occupancyPct ?? 0))
    .slice(0, limit);
}

export function rankLowestOccupied(
  rows: ClassOccupancyRow[],
  limit = 5
): ClassOccupancyRow[] {
  return [...rows]
    .filter((r) => r.occupancyPct !== null)
    .sort((a, b) => (a.occupancyPct ?? 0) - (b.occupancyPct ?? 0))
    .slice(0, limit);
}

export function rankMostCancelled(
  rows: ClassOccupancyRow[],
  limit = 5
): ClassOccupancyRow[] {
  return [...rows]
    .filter((r) => r.cancellations > 0)
    .sort((a, b) => b.cancellations - a.cancellations)
    .slice(0, limit);
}

export function rankConstantAthletes(
  reservas: ReportReservaRow[],
  sociosById: Map<string, string>,
  limit = 10
): AthleteConstancyRow[] {
  const counts = new Map<string, number>();
  for (const r of reservas) {
    if (r.estado !== "asistio") continue;
    counts.set(r.usuario_id, (counts.get(r.usuario_id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([profileId, attendances]) => ({
      profileId,
      nombre: sociosById.get(profileId) ?? "Atleta",
      attendances,
    }))
    .sort(
      (a, b) =>
        b.attendances - a.attendances || a.nombre.localeCompare(b.nombre)
    )
    .slice(0, limit);
}

/**
 * Atletas activos (display activo|por_vencer) con última asistencia ≥ minDays.
 * Misma regla que findInactiveAthletes del dashboard (excluye nunca-asistentes).
 */
export function findInactiveForReport(
  activeSocios: { id: string; nombre_completo: string }[],
  lastAttendanceByUser: Map<string, string>,
  today: string,
  minDays = 10
): AthleteInactiveRow[] {
  return findInactiveAthletes(
    activeSocios,
    lastAttendanceByUser,
    today,
    minDays
  ).map((a) => ({
    profileId: a.profileId,
    nombre: a.nombre,
    daysSinceAttendance: a.daysSinceAttendance,
  }));
}

export function countNewAthletesInRange(
  socios: ReportSocioRow[],
  range: WeekRange,
  timeZone: string
): { count: number; names: AthleteNameRow[] } {
  const names: AthleteNameRow[] = [];
  for (const s of socios) {
    const createdDay = createdAtToDateOnly(s.created_at, timeZone);
    if (createdDay >= range.from && createdDay <= range.to) {
      names.push({ profileId: s.id, nombre: s.nombre_completo });
    }
  }
  return { count: names.length, names };
}

export function createdAtToDateOnly(
  iso: string,
  timeZone: string
): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "01";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function countPrsInRange(
  prs: ReportPrRow[],
  range: WeekRange
): number {
  return prs.filter((p) => p.fecha >= range.from && p.fecha <= range.to).length;
}

export function membershipCounts(
  socios: ReportSocioRow[],
  membershipByUser: Map<string, ReportMembershipRow>,
  timeZone: string
): {
  active: number;
  expiring: number;
  expired: number;
  expiringAthletes: AthleteNameRow[];
  activeSocioIds: string[];
  displayByUser: Map<string, SocioDisplayStatus>;
} {
  let active = 0;
  let expiring = 0;
  let expired = 0;
  const expiringAthletes: AthleteNameRow[] = [];
  const activeSocioIds: string[] = [];
  const displayByUser = new Map<string, SocioDisplayStatus>();

  for (const s of socios) {
    const m = membershipByUser.get(s.id) ?? null;
    const status = getSocioDisplayStatus(s, m, timeZone);
    displayByUser.set(s.id, status);
    if (status === "activo") {
      active += 1;
      activeSocioIds.push(s.id);
    } else if (status === "por_vencer") {
      active += 1;
      expiring += 1;
      activeSocioIds.push(s.id);
      expiringAthletes.push({
        profileId: s.id,
        nombre: s.nombre_completo,
      });
    } else if (status === "vencida") {
      expired += 1;
    }
  }

  return {
    active,
    expiring,
    expired,
    expiringAthletes,
    activeSocioIds,
    displayByUser,
  };
}

export function buildLastAttendanceMap(
  reservas: ReportReservaRow[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of reservas) {
    if (r.estado !== "asistio") continue;
    const prev = map.get(r.usuario_id);
    if (!prev || r.claseFecha > prev) {
      map.set(r.usuario_id, r.claseFecha);
    }
  }
  return map;
}

export type ComputeWeeklyReportInput = {
  timeZone: string;
  today: string;
  week: WeekRange;
  previousWeek: WeekRange;
  classesThisWeek: ReportClassRow[];
  classesPrevWeek: ReportClassRow[];
  reservasThisWeek: ReportReservaRow[];
  reservasPrevWeek: ReportReservaRow[];
  /** Reservas de asistencia históricas del box (para inactividad). */
  attendanceHistory: ReportReservaRow[];
  socios: ReportSocioRow[];
  membershipByUser: Map<string, ReportMembershipRow>;
  prs: ReportPrRow[];
};

export function computeWeeklyReportMetrics(
  input: ComputeWeeklyReportInput
): WeeklyReportMetrics {
  const {
    timeZone,
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
  } = input;

  const held = classesThisWeek.filter((c) =>
    isClassHeld(c, week, timeZone, today)
  );
  const heldPrev = classesPrevWeek.filter((c) =>
    isClassHeld(c, previousWeek, timeZone, today)
  );

  const uniqueAthletes = countUniqueAthletesAttended(reservasThisWeek);
  const uniqueAthletesPrev = countUniqueAthletesAttended(reservasPrevWeek);
  const totalReservations = countTotalReservations(reservasThisWeek);
  const totalReservationsPrev = countTotalReservations(reservasPrevWeek);
  const totalAttendances = countAttendances(reservasThisWeek);
  const totalAttendancesPrev = countAttendances(reservasPrevWeek);
  const totalCancellations = countCancellations(reservasThisWeek);
  const totalCancellationsPrev = countCancellations(reservasPrevWeek);

  const occupancyClasses = held.map((c) => ({
    cupo_ocupado: c.cupo_ocupado,
    cupo_maximo: c.cupo_maximo,
  }));
  const occupancyClassesPrev = heldPrev.map((c) => ({
    cupo_ocupado: c.cupo_ocupado,
    cupo_maximo: c.cupo_maximo,
  }));

  const avgOccupancyPct =
    occupancyClasses.filter((c) => c.cupo_maximo > 0).length > 0
      ? computeAverageOccupancy(occupancyClasses)
      : null;
  const avgOccupancyPrev =
    occupancyClassesPrev.filter((c) => c.cupo_maximo > 0).length > 0
      ? computeAverageOccupancy(occupancyClassesPrev)
      : null;

  const newThis = countNewAthletesInRange(socios, week, timeZone);
  const newPrev = countNewAthletesInRange(socios, previousWeek, timeZone);

  const memb = membershipCounts(socios, membershipByUser, timeZone);
  const sociosById = new Map(socios.map((s) => [s.id, s.nombre_completo]));

  const classRows = buildClassOccupancyRows(classesThisWeek, reservasThisWeek);
  const heldIds = new Set(held.map((c) => c.id));
  const heldRows = classRows.filter((r) => heldIds.has(r.id));

  const capacityOffered = held.reduce(
    (acc, c) => acc + Math.max(0, c.cupo_maximo),
    0
  );
  const capacityOccupied = held.reduce(
    (acc, c) =>
      acc + (c.cupo_maximo > 0 ? Math.min(c.cupo_ocupado, c.cupo_maximo) : 0),
    0
  );

  const avgAttendeesPerClass =
    held.length > 0
      ? Math.round((totalAttendances / held.length) * 10) / 10
      : null;

  const activeSocios = socios.filter((s) =>
    memb.activeSocioIds.includes(s.id)
  );
  const lastAttendance = buildLastAttendanceMap(attendanceHistory);
  const inactiveAthletes = findInactiveForReport(
    activeSocios,
    lastAttendance,
    today,
    10
  );

  const metrics: WeeklyReportMetrics = {
    uniqueAthletesAttended: uniqueAthletes,
    classesHeld: held.length,
    totalReservations,
    totalAttendances,
    totalCancellations,
    avgOccupancyPct,
    newAthletes: newThis.count,
    membershipsActive: memb.active,
    membershipsExpiringSoon: memb.expiring,
    membershipsExpired: memb.expired,
    prsRegistered: countPrsInRange(prs, week),
    avgAttendeesPerClass,
    capacityOffered,
    capacityOccupied,
    topOccupiedClasses: rankTopOccupied(heldRows),
    lowestOccupiedClasses: rankLowestOccupied(heldRows),
    mostCancelledClasses: rankMostCancelled(classRows),
    topConstantAthletes: rankConstantAthletes(
      reservasThisWeek,
      sociosById
    ),
    inactiveAthletes: inactiveAthletes.slice(0, 15),
    expiringAthletes: memb.expiringAthletes.slice(0, 15),
    newAthleteNames: newThis.names.slice(0, 15),
    comparison: {
      uniqueAthletesAttended: compareMetric(uniqueAthletes, uniqueAthletesPrev),
      totalAttendances: compareMetric(totalAttendances, totalAttendancesPrev),
      totalReservations: compareMetric(
        totalReservations,
        totalReservationsPrev
      ),
      totalCancellations: compareMetric(
        totalCancellations,
        totalCancellationsPrev
      ),
      avgOccupancyPct: compareNullableMetric(avgOccupancyPct, avgOccupancyPrev),
      newAthletes: compareMetric(newThis.count, newPrev.count),
    },
    narrative: "",
  };

  metrics.narrative = buildWeeklyNarrative(metrics);
  return metrics;
}
