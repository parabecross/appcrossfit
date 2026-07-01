import { describe, expect, it } from "vitest";
import {
  ANALYTICS_CHILD_FEATURES,
  RANKING_CHILD_FEATURES,
  applyFeatureDependencies,
  dependencyBlockMessage,
  getSuperAdminFeatureLabel,
} from "@/lib/entitlements/feature-deps";
import type { BoxEntitlements, FeatureEntitlement } from "@/lib/entitlements/types";
import { buildPlanFeatures } from "@/lib/entitlements/features";

describe("feature dependencies", () => {
  it("forces ranking children off when ranking is off", () => {
    const raw = buildPlanFeatures("pro");
    raw.ranking = false;
    raw.ranking_publico = true;

    const { effective, blockedBy } = applyFeatureDependencies(raw);

    expect(effective.ranking).toBe(false);
    expect(effective.ranking_publico).toBe(false);
    expect(blockedBy.ranking_publico).toBe("ranking");
  });

  it("forces analytics children off when estadisticas_avanzadas is off", () => {
    const raw = buildPlanFeatures("pro");
    raw.estadisticas_avanzadas = false;
    raw.dashboard_ejecutivo = true;
    raw.resumen_semanal = true;

    const { effective, blockedBy } = applyFeatureDependencies(raw);

    expect(effective.estadisticas_avanzadas).toBe(false);
    expect(effective.dashboard_ejecutivo).toBe(false);
    expect(effective.resumen_semanal).toBe(false);
    expect(blockedBy.dashboard_ejecutivo).toBe("estadisticas_avanzadas");
    expect(blockedBy.resumen_semanal).toBe("estadisticas_avanzadas");
  });

  it("keeps children on when parent is on", () => {
    const raw = buildPlanFeatures("pro");
    const { effective } = applyFeatureDependencies(raw);

    for (const key of RANKING_CHILD_FEATURES) {
      expect(effective[key]).toBe(true);
    }
    for (const key of ANALYTICS_CHILD_FEATURES) {
      expect(effective[key]).toBe(true);
    }
  });

  it("labels dependency blocks clearly", () => {
    expect(dependencyBlockMessage("ranking")).toBe("Requiere activar Ranking");
    expect(dependencyBlockMessage("estadisticas_avanzadas")).toBe(
      "Requiere activar Estadísticas avanzadas"
    );
  });

  it("labels manual override when enabled", () => {
    const detail: FeatureEntitlement = {
      key: "ranking",
      enabled: true,
      effectiveEnabled: true,
      source: "override",
    };
    const ent = {
      effectivePlanCode: "start",
    } as BoxEntitlements;

    expect(getSuperAdminFeatureLabel(detail, ent)).toBe(
      "Habilitado manualmente por Super Admin"
    );
  });
});
