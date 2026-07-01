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
    throw new EntitlementError(
      "Tu box está suspendido. Contacta a soporte ATHRON para reactivar el acceso."
    );
  }
  if (!canUseFeature(entitlements, featureKey)) {
    const label = minPlanLabelForFeature(featureKey);
    const detail = entitlements.featureDetails.find((d) => d.key === featureKey);
    if (detail?.blockedBy) {
      throw new EntitlementError(
        detail.blockedBy === "ranking"
          ? "Esta función requiere tener Ranking activo."
          : "Esta función requiere tener Estadísticas avanzadas activas."
      );
    }
    throw new EntitlementError(
      label
        ? `Esta función está disponible en ${label}.`
        : "Esta función no está incluida en tu plan actual."
    );
  }
}
