import {
  addDaysToDateString,
  dateStringToLocalDate,
  todayInTimezone,
  toDateString,
} from "@/lib/dates/date-only";
import type { AlertaMembresia } from "@/types/database";

export type ClassCupoStatus = "available" | "almost_full" | "full";

export function getWeekRangeInTimezone(timeZone: string): {
  from: string;
  to: string;
} {
  const today = todayInTimezone(timeZone);
  const start = dateStringToLocalDate(today);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  const from = toDateString(start);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { from, to: toDateString(end) };
}

export function getPreviousWeekRange(timeZone: string): {
  from: string;
  to: string;
} {
  const current = getWeekRangeInTimezone(timeZone);
  return {
    from: addDaysToDateString(current.from, -7),
    to: addDaysToDateString(current.to, -7),
  };
}

export function getCupoStatus(
  occupied: number,
  max: number
): ClassCupoStatus {
  if (occupied >= max) return "full";
  if (max > 0 && occupied / max >= 0.7) return "almost_full";
  return "available";
}

export function computeAverageOccupancy(
  classes: { cupo_ocupado: number; cupo_maximo: number }[]
): number {
  if (classes.length === 0) return 0;
  const sum = classes.reduce((acc, c) => {
    if (c.cupo_maximo <= 0) return acc;
    return acc + (c.cupo_ocupado / c.cupo_maximo) * 100;
  }, 0);
  return Math.round(sum / classes.length);
}

/** Remaining bookable spots across classes with a positive capacity. */
export function computeAvailableSpots(
  classes: { cupo_ocupado: number; cupo_maximo: number }[]
): number {
  return classes.reduce((acc, c) => {
    if (c.cupo_maximo <= 0) return acc;
    return acc + Math.max(0, c.cupo_maximo - c.cupo_ocupado);
  }, 0);
}

export function filterFullClasses<
  T extends { cupo_ocupado: number; cupo_maximo: number },
>(classes: T[]): T[] {
  return classes.filter(
    (c) => c.cupo_maximo > 0 && c.cupo_ocupado >= c.cupo_maximo
  );
}

/** Low occupancy: under 40% filled (same threshold as dashboard alerts). */
export function filterLowOccupancyClasses<
  T extends { cupo_ocupado: number; cupo_maximo: number },
>(classes: T[], thresholdPct = 40): T[] {
  return classes.filter((c) => {
    if (c.cupo_maximo <= 0) return false;
    const pct = (c.cupo_ocupado / c.cupo_maximo) * 100;
    return pct < thresholdPct && pct >= 0;
  });
}

export function countAttendanceInRange(
  reservas: Array<{
    estado: string;
    clase: { fecha: string } | null;
  }>,
  from: string,
  to: string
): number {
  return reservas.filter(
    (r) =>
      r.estado === "asistio" &&
      r.clase?.fecha &&
      r.clase.fecha >= from &&
      r.clase.fecha <= to
  ).length;
}

export interface WeeklySummaryData {
  attendanceThisWeek: number;
  attendanceLastWeek: number;
  attendanceDelta: number;
  topClassName: string | null;
  topClassBookings: number;
  lowClassName: string | null;
  lowClassBookings: number;
  avgOccupancyThisWeek: number | null;
  prsThisWeek: number;
  goalsCompleted: number;
  membershipsRenewed: number;
}

export function computeWeeklySummary(
  reservas: Array<{
    estado: string;
    clase_id?: string;
    clase: { fecha: string; nombre?: string } | null;
  }>,
  weekFrom: string,
  weekTo: string,
  prevFrom: string,
  prevTo: string,
  prsThisWeek: number,
  goalsCompleted: number,
  membershipsRenewed: number,
  weekClasses?: { cupo_ocupado: number; cupo_maximo: number }[]
): WeeklySummaryData {
  const attendanceThisWeek = countAttendanceInRange(
    reservas,
    weekFrom,
    weekTo
  );
  const attendanceLastWeek = countAttendanceInRange(
    reservas,
    prevFrom,
    prevTo
  );

  const classBookings = new Map<string, { name: string; count: number }>();
  for (const r of reservas) {
    if (!r.clase?.fecha || !r.clase_id) continue;
    if (r.clase.fecha < weekFrom || r.clase.fecha > weekTo) continue;
    if (!["confirmada", "asistio"].includes(r.estado)) continue;
    const cur = classBookings.get(r.clase_id) ?? {
      name: r.clase.nombre ?? "—",
      count: 0,
    };
    cur.count += 1;
    classBookings.set(r.clase_id, cur);
  }

  let topClassName: string | null = null;
  let topClassBookings = 0;
  let lowClassName: string | null = null;
  let lowClassBookings = Number.POSITIVE_INFINITY;

  for (const { name, count } of Array.from(classBookings.values())) {
    if (count > topClassBookings) {
      topClassBookings = count;
      topClassName = name;
    }
    if (count < lowClassBookings) {
      lowClassBookings = count;
      lowClassName = name;
    }
  }

  if (lowClassBookings === Number.POSITIVE_INFINITY) {
    lowClassBookings = 0;
    lowClassName = null;
  }

  // Avoid presenting the same class as both highest and lowest demand.
  if (
    topClassName &&
    lowClassName &&
    topClassName === lowClassName &&
    classBookings.size <= 1
  ) {
    lowClassName = null;
    lowClassBookings = 0;
  }

  return {
    attendanceThisWeek,
    attendanceLastWeek,
    attendanceDelta: attendanceThisWeek - attendanceLastWeek,
    topClassName,
    topClassBookings,
    lowClassName,
    lowClassBookings,
    avgOccupancyThisWeek:
      weekClasses && weekClasses.length > 0
        ? computeAverageOccupancy(weekClasses)
        : null,
    prsThisWeek,
    goalsCompleted,
    membershipsRenewed,
  };
}

export interface DashboardActivityEvent {
  id: string;
  type: "reserva" | "asistencia" | "pr" | "skill" | "membresia";
  at: string;
  title: string;
  subtitle?: string;
}

export function mergeActivityEvents(
  events: DashboardActivityEvent[],
  options: { limit?: number; today?: string; maxDays?: number } = {}
): DashboardActivityEvent[] {
  const { limit = 80, today, maxDays = 7 } = options;
  const minDate =
    today && maxDays > 0
      ? addDaysToDateString(today, -(maxDays - 1))
      : null;

  return [...events]
    .filter((e) => !minDate || e.at.slice(0, 10) >= minDate)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

export type ActivityDayGroup = {
  dateKey: string;
  events: DashboardActivityEvent[];
};

export function groupActivityByDay(
  events: DashboardActivityEvent[]
): ActivityDayGroup[] {
  const byDay = new Map<string, DashboardActivityEvent[]>();

  for (const event of events) {
    const dateKey = event.at.slice(0, 10);
    const bucket = byDay.get(dateKey);
    if (bucket) bucket.push(event);
    else byDay.set(dateKey, [event]);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, dayEvents]) => ({
      dateKey,
      events: dayEvents.sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
      ),
    }));
}

export interface InactiveAthleteAlert {
  profileId: string;
  nombre: string;
  daysSinceAttendance: number;
  telefono?: string | null;
  fotoUrl?: string | null;
}

export function findInactiveAthletes(
  socios: {
    id: string;
    nombre_completo: string;
    telefono?: string | null;
    foto_url?: string | null;
  }[],
  lastAttendanceByUser: Map<string, string>,
  today: string,
  minDays = 7
): InactiveAthleteAlert[] {
  const alerts: InactiveAthleteAlert[] = [];

  for (const s of socios) {
    const last = lastAttendanceByUser.get(s.id);
    if (!last) continue;

    const days = daysBetween(last, today);
    if (days >= minDays) {
      alerts.push({
        profileId: s.id,
        nombre: s.nombre_completo,
        daysSinceAttendance: days,
        telefono: s.telefono ?? null,
        fotoUrl: s.foto_url ?? null,
      });
    }
  }

  return alerts.sort((a, b) => b.daysSinceAttendance - a.daysSinceAttendance);
}

export function findAthletesWithoutWeekBooking(
  activeSocioIds: string[],
  bookedThisWeek: Set<string>
): string[] {
  return activeSocioIds.filter((id) => !bookedThisWeek.has(id));
}

function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000
  );
}

export function partitionMembershipAlerts(alertas: AlertaMembresia[]) {
  return {
    vencidas: alertas.filter((a) => a.tipo_alerta === "vencida"),
    porVencer: alertas.filter((a) => a.tipo_alerta === "por_vencer"),
  };
}
