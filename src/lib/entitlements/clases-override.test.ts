import { describe, expect, it } from "vitest";
import { buildPlanFeatures } from "@/lib/entitlements/features";
import { applyFeatureDependencies } from "@/lib/entitlements/feature-deps";
import {
  assertFeatureEnabled,
  canUseFeature,
} from "@/lib/entitlements/permissions";
import { EntitlementError } from "@/lib/entitlements/types";
import type { BoxEntitlements } from "@/lib/entitlements/types";

function entitlementsWithOverride(
  enabled: boolean
): BoxEntitlements {
  const raw = buildPlanFeatures("elite");
  raw.clases = enabled;
  const { effective } = applyFeatureDependencies(raw);
  return {
    features: effective,
    featureDetails: [
      {
        key: "clases",
        enabled,
        effectiveEnabled: effective.clases,
        source: "override",
      },
    ],
    subscription: { status: "trialing" },
    canWrite: true,
  } as unknown as BoxEntitlements;
}

describe("clases feature overrides", () => {
  it("blocks clases when super admin override is off", () => {
    const ent = entitlementsWithOverride(false);
    expect(canUseFeature(ent, "clases")).toBe(false);
    expect(() => assertFeatureEnabled(ent, "clases")).toThrow(EntitlementError);
    expect(() => assertFeatureEnabled(ent, "clases")).toThrow(
      /desactivada para tu box/i
    );
  });

  it("allows clases when override is on", () => {
    const ent = entitlementsWithOverride(true);
    expect(canUseFeature(ent, "clases")).toBe(true);
    expect(() => assertFeatureEnabled(ent, "clases")).not.toThrow();
  });
});
