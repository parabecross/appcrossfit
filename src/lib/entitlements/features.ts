export const FEATURE_KEYS = [
  "dashboard_basico",
  "clases",
  "reservas",
  "membresias",
  "asistencia",
  "ranking",
  "ranking_publico",
  "ranking_config",
  "progreso_atleta",
  "dashboard_ejecutivo",
  "estadisticas_avanzadas",
  "frecuencia_usuario",
  "demanda_horario",
  "ocupacion_promedio",
  "tendencia_asistencia",
  "historial_completo",
  "alertas_avanzadas",
  "resumen_semanal",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type PlanCode = "start" | "pro" | "elite";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "grace_period"
  | "expired"
  | "suspended"
  | "canceled";

export type ResourceType = "atletas" | "coaches" | "admins";

/** Funciones incluidas en ATHRON Start (módulos base reales). */
export const START_FEATURE_KEYS: FeatureKey[] = [
  "dashboard_basico",
  "clases",
  "reservas",
  "membresias",
  "asistencia",
];

/** Funciones premium reales (ATHRON Pro en adelante). */
export const PRO_FEATURE_KEYS: FeatureKey[] = [
  "ranking",
  "ranking_publico",
  "ranking_config",
  "progreso_atleta",
  "dashboard_ejecutivo",
  "estadisticas_avanzadas",
  "frecuencia_usuario",
  "demanda_horario",
  "ocupacion_promedio",
  "tendencia_asistencia",
  "historial_completo",
  "alertas_avanzadas",
  "resumen_semanal",
];

export const PLAN_MIN_CODE_FOR_FEATURE: Partial<Record<FeatureKey, PlanCode>> = {
  ranking: "pro",
  ranking_publico: "pro",
  ranking_config: "pro",
  progreso_atleta: "pro",
  estadisticas_avanzadas: "pro",
  dashboard_ejecutivo: "pro",
  frecuencia_usuario: "pro",
  demanda_horario: "pro",
  ocupacion_promedio: "pro",
  tendencia_asistencia: "pro",
  historial_completo: "pro",
  alertas_avanzadas: "pro",
  resumen_semanal: "pro",
};

export const PLAN_LABELS: Record<PlanCode, string> = {
  start: "ATHRON Start",
  pro: "ATHRON Pro",
  elite: "ATHRON Elite",
};

export const STATUS_LABELS_BOX: Record<SubscriptionStatus, string> = {
  trialing: "Acceso promocional activo",
  active: "Activo",
  grace_period: "Periodo de gracia",
  expired: "Acceso finalizado",
  suspended: "Suspendido",
  canceled: "Cancelado",
};

export const STATUS_LABELS_SUPER_ADMIN: Record<SubscriptionStatus, string> = {
  trialing: "Acceso promocional",
  active: "Activo",
  grace_period: "Periodo de gracia",
  expired: "Expirado",
  suspended: "Suspendido",
  canceled: "Cancelado",
};

export function planRank(code: PlanCode): number {
  return code === "start" ? 1 : code === "pro" ? 2 : 3;
}

export function minPlanLabelForFeature(feature: FeatureKey): string | null {
  const code = PLAN_MIN_CODE_FOR_FEATURE[feature];
  return code ? PLAN_LABELS[code] : null;
}

export function buildPlanFeatures(code: PlanCode): Record<FeatureKey, boolean> {
  const features = Object.fromEntries(
    FEATURE_KEYS.map((key) => [key, false])
  ) as Record<FeatureKey, boolean>;

  for (const key of START_FEATURE_KEYS) {
    features[key] = true;
  }

  if (code === "pro" || code === "elite") {
    for (const key of PRO_FEATURE_KEYS) {
      features[key] = true;
    }
  }

  return features;
}

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  dashboard_basico: "Dashboard básico",
  clases: "Clases",
  reservas: "Reservas",
  membresias: "Membresías",
  asistencia: "Asistencia",
  ranking: "Ranking",
  ranking_publico: "Ranking público",
  ranking_config: "Configuración de ranking",
  progreso_atleta: "Progreso del atleta",
  estadisticas_avanzadas: "Estadísticas avanzadas",
  dashboard_ejecutivo: "Dashboard ejecutivo",
  frecuencia_usuario: "Frecuencia por usuario",
  demanda_horario: "Demanda por horario",
  ocupacion_promedio: "Ocupación promedio",
  tendencia_asistencia: "Tendencia de asistencia",
  historial_completo: "Historial completo",
  alertas_avanzadas: "Alertas avanzadas",
  resumen_semanal: "Resumen semanal",
};

/** Claves eliminadas del sistema (solo para limpieza de overrides legacy). */
export const REMOVED_FEATURE_KEYS = [
  "gestion_atletas",
  "gestion_coaches",
  "pwa",
  "exportaciones",
  "branding_personalizado",
  "integraciones",
  "ia",
  "soporte_prioritario",
  "soporte_premium",
] as const;
