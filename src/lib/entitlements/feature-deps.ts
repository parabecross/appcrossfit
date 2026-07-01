import {
  FEATURE_LABELS,
  PLAN_LABELS,
  minPlanLabelForFeature,
  type FeatureKey,
} from "./features";
import type { BoxEntitlements, FeatureEntitlement } from "./types";

/** Hijos que requieren que Ranking esté activo. */
export const RANKING_CHILD_FEATURES: FeatureKey[] = [
  "ranking_publico",
  "ranking_config",
  "progreso_atleta",
];

/** Hijos que requieren que Estadísticas avanzadas esté activo. */
export const ANALYTICS_CHILD_FEATURES: FeatureKey[] = [
  "dashboard_ejecutivo",
  "frecuencia_usuario",
  "demanda_horario",
  "ocupacion_promedio",
  "tendencia_asistencia",
  "historial_completo",
  "alertas_avanzadas",
  "resumen_semanal",
];

export const FEATURE_PARENT_MAP: Partial<Record<FeatureKey, FeatureKey>> = {
  ...Object.fromEntries(
    RANKING_CHILD_FEATURES.map((k) => [k, "ranking" as FeatureKey])
  ),
  ...Object.fromEntries(
    ANALYTICS_CHILD_FEATURES.map((k) => [k, "estadisticas_avanzadas" as FeatureKey])
  ),
};

export type FeatureUiGroup =
  | { type: "standalone"; keys: FeatureKey[] }
  | { type: "group"; parent: FeatureKey; children: FeatureKey[] };

/** Orden y jerarquía del panel Super Admin. */
export const FEATURE_UI_GROUPS: FeatureUiGroup[] = [
  {
    type: "standalone",
    keys: [
      "dashboard_basico",
      "clases",
      "reservas",
      "membresias",
      "asistencia",
    ],
  },
  { type: "group", parent: "ranking", children: RANKING_CHILD_FEATURES },
  {
    type: "group",
    parent: "estadisticas_avanzadas",
    children: ANALYTICS_CHILD_FEATURES,
  },
];

export function getParentFeature(key: FeatureKey): FeatureKey | null {
  return FEATURE_PARENT_MAP[key] ?? null;
}

export function dependencyBlockMessage(parent: FeatureKey): string {
  if (parent === "ranking") return "Requiere activar Ranking";
  if (parent === "estadisticas_avanzadas") {
    return "Requiere activar Estadísticas avanzadas";
  }
  return `Requiere activar ${FEATURE_LABELS[parent]}`;
}

export function applyFeatureDependencies(
  raw: Record<FeatureKey, boolean>
): {
  effective: Record<FeatureKey, boolean>;
  blockedBy: Partial<Record<FeatureKey, FeatureKey>>;
} {
  const effective = { ...raw };
  const blockedBy: Partial<Record<FeatureKey, FeatureKey>> = {};

  const rules: { parent: FeatureKey; children: FeatureKey[] }[] = [
    { parent: "ranking", children: RANKING_CHILD_FEATURES },
    { parent: "estadisticas_avanzadas", children: ANALYTICS_CHILD_FEATURES },
  ];

  for (const { parent, children } of rules) {
    if (effective[parent]) continue;
    for (const child of children) {
      if (raw[child]) {
        blockedBy[child] = parent;
      }
      effective[child] = false;
    }
  }

  return { effective, blockedBy };
}

export function enrichFeatureDetails(
  rawFeatures: Record<FeatureKey, boolean>,
  details: FeatureEntitlement[]
): {
  features: Record<FeatureKey, boolean>;
  featureDetails: FeatureEntitlement[];
} {
  const { effective, blockedBy } = applyFeatureDependencies(rawFeatures);

  const featureDetails = details.map((detail) => ({
    ...detail,
    effectiveEnabled: effective[detail.key],
    blockedBy: blockedBy[detail.key],
  }));

  return { features: effective, featureDetails };
}

export function getSuperAdminFeatureLabel(
  detail: FeatureEntitlement,
  ent: BoxEntitlements
): string {
  const effective =
    detail.effectiveEnabled ?? detail.enabled;
  const blockedBy = detail.blockedBy;

  if (blockedBy) {
    return dependencyBlockMessage(blockedBy);
  }

  if (!effective) {
    if (detail.source === "override" && !detail.enabled) {
      return "Desactivado manualmente por Super Admin";
    }
    const minPlan = minPlanLabelForFeature(detail.key);
    if (minPlan) return `Disponible en ${minPlan}`;
    return "No incluido en el plan actual";
  }

  if (detail.source === "override" && detail.enabled) {
    return "Habilitado manualmente por Super Admin";
  }

  if (detail.source === "promotional") {
    return "Incluido en acceso promocional ATHRON Elite";
  }

  const planLabel = PLAN_LABELS[ent.effectivePlanCode];
  return planLabel ? `Incluido en ${planLabel}` : "Incluido en su plan";
}

export function isFeatureToggleDisabled(
  key: FeatureKey,
  features: Record<FeatureKey, boolean>
): boolean {
  const parent = getParentFeature(key);
  if (!parent) return false;
  return !features[parent];
}
