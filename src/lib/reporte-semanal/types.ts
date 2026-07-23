/** Modelo interno del reporte semanal ejecutivo (solo lectura). */

export type WeekRange = {
  from: string;
  to: string;
};

export type MetricComparison = {
  current: number;
  previous: number;
  absoluteDelta: number;
  /** null cuando el porcentaje no es comparable (prev = 0 y current > 0, etc.) */
  percentDelta: number | null;
  label: "ok" | "sin_datos" | "nuevo" | "sin_cambio";
};

export type ClassOccupancyRow = {
  id: string;
  label: string;
  fecha: string;
  horaInicio: string;
  cupoOcupado: number;
  cupoMaximo: number;
  occupancyPct: number | null;
  cancellations: number;
  attendances: number;
};

export type AthleteConstancyRow = {
  profileId: string;
  nombre: string;
  attendances: number;
};

export type AthleteInactiveRow = {
  profileId: string;
  nombre: string;
  daysSinceAttendance: number;
};

export type AthleteNameRow = {
  profileId: string;
  nombre: string;
};

export type WeeklyReportMetrics = {
  uniqueAthletesAttended: number;
  classesHeld: number;
  totalReservations: number;
  totalAttendances: number;
  totalCancellations: number;
  avgOccupancyPct: number | null;
  newAthletes: number;
  membershipsActive: number;
  membershipsExpiringSoon: number;
  membershipsExpired: number;
  prsRegistered: number;
  avgAttendeesPerClass: number | null;
  capacityOffered: number;
  capacityOccupied: number;
  topOccupiedClasses: ClassOccupancyRow[];
  lowestOccupiedClasses: ClassOccupancyRow[];
  mostCancelledClasses: ClassOccupancyRow[];
  topConstantAthletes: AthleteConstancyRow[];
  inactiveAthletes: AthleteInactiveRow[];
  expiringAthletes: AthleteNameRow[];
  newAthleteNames: AthleteNameRow[];
  comparison: {
    uniqueAthletesAttended: MetricComparison;
    totalAttendances: MetricComparison;
    totalReservations: MetricComparison;
    totalCancellations: MetricComparison;
    avgOccupancyPct: MetricComparison;
    newAthletes: MetricComparison;
  };
  narrative: string;
};

export type WeeklyReportModel = {
  boxId: string;
  boxName: string;
  timezone: string;
  logoUrl: string | null;
  title: string;
  week: WeekRange;
  previousWeek: WeekRange;
  weekLabel: string;
  previousWeekLabel: string;
  generatedAtLabel: string;
  metrics: WeeklyReportMetrics;
  hasOperationalData: boolean;
};

/** Filas crudas normalizadas para cálculo puro (sin I/O). */
export type ReportClassRow = {
  id: string;
  nombre: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  cupo_maximo: number;
  cupo_ocupado: number;
  estado: "programada" | "cancelada";
  coach_nombre: string | null;
};

export type ReportReservaRow = {
  id: string;
  usuario_id: string;
  clase_id: string;
  estado: "confirmada" | "cancelada" | "asistio" | "no_asistio";
  claseFecha: string;
};

export type ReportSocioRow = {
  id: string;
  nombre_completo: string;
  estado_cuenta: "pendiente_pago" | "activo" | "inactivo";
  created_at: string;
};

export type ReportMembershipRow = {
  usuario_id: string;
  estado: "vigente" | "vencida" | "cancelada";
  fecha_inicio: string;
  fecha_fin: string;
  plan_nombre: string | null;
};

export type ReportPrRow = {
  usuario_id: string;
  fecha: string;
};
