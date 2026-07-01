import { describe, expect, it } from "vitest";
import {
  FEATURE_KEYS,
  PLAN_MIN_CODE_FOR_FEATURE,
  PLAN_LABELS,
  PRO_FEATURE_KEYS,
  REMOVED_FEATURE_KEYS,
  START_FEATURE_KEYS,
  buildPlanFeatures,
  minPlanLabelForFeature,
} from "@/lib/entitlements/features";

describe("entitlements features", () => {
  it("maps ranking to ATHRON Pro", () => {
    expect(minPlanLabelForFeature("ranking")).toBe(PLAN_LABELS.pro);
  });

  it("does not include removed phantom features", () => {
    for (const key of REMOVED_FEATURE_KEYS) {
      expect(FEATURE_KEYS).not.toContain(key);
    }
  });

  it("start plan enables only base modules", () => {
    const features = buildPlanFeatures("start");
    for (const key of START_FEATURE_KEYS) {
      expect(features[key]).toBe(true);
    }
    for (const key of PRO_FEATURE_KEYS) {
      expect(features[key]).toBe(false);
    }
  });

  it("pro and elite enable all real modules", () => {
    for (const code of ["pro", "elite"] as const) {
      const features = buildPlanFeatures(code);
      for (const key of FEATURE_KEYS) {
        expect(features[key]).toBe(true);
      }
    }
  });

  it("covers premium gated features at pro tier", () => {
    expect(PLAN_MIN_CODE_FOR_FEATURE.ranking).toBe("pro");
    expect(PLAN_MIN_CODE_FOR_FEATURE.estadisticas_avanzadas).toBe("pro");
    expect(PLAN_MIN_CODE_FOR_FEATURE.resumen_semanal).toBe("pro");
  });
});
