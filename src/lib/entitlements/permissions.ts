import { minPlanLabelForFeature, type FeatureKey } from "./features";
import type { BoxEntitlements } from "./types";
import { EntitlementError } from "./types";

export function canUseFeature(
  entitlements: BoxEntitlements,
  featureKey: FeatureKey
): boolean {
  if (["expired", "canceled"].includes(entitlements.subscription.status)) {
    const baseAllowed: FeatureKey[] = [
      "dashboard_basico",
      "clases",
      "reservas",
      "membresias",
      "asistencia",
    ];
    if (!baseAllowed.includes(featureKey)) return false;
  }
  return Boolean(entitlements.features[featureKey]);
}

export function canAccessPublicRanking(entitlements: BoxEntitlements): boolean {
  return (
    canUseFeature(entitlements, "ranking") &&
    canUseFeature(entitlements, "ranking_publico")
  );
}

export function assertFeatureEnabled(
  entitlements: BoxEntitlements,
  featureKey: FeatureKey
) {
  if (!entitlements.canWrite) {
    const status = entitlements.subscription.status;
    throw new EntitlementError(
      status === "expired"
        ? "Tu acceso finalizó. Contacta a soporte ATHRON o elige un plan."
        : status === "canceled"
          ? "Tu suscripción está cancelada. Reactiva el acceso para continuar."
          : "Tu box está suspendido. Contacta a soporte ATHRON para reactivar el acceso."
    );
  }
  if (!canUseFeature(entitlements, featureKey)) {
    const detail = entitlements.featureDetails.find((d) => d.key === featureKey);
    if (detail?.source === "override" && !detail.enabled) {
      throw new EntitlementError(
        "Esta función fue desactivada para tu box. Contacta a soporte ATHRON."
      );
    }
    if (detail?.blockedBy) {
      throw new EntitlementError(
        detail.blockedBy === "ranking"
          ? "Esta función requiere tener Ranking activo."
          : "Esta función requiere tener Estadísticas avanzadas activas."
      );
    }
    const label = minPlanLabelForFeature(featureKey);
    throw new EntitlementError(
      label
        ? `Esta función está disponible en ${label}.`
        : "Esta función no está incluida en tu plan actual."
    );
  }
}
