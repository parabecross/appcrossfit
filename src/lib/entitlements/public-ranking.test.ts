import { describe, expect, it } from "vitest";
import { buildPlanFeatures } from "@/lib/entitlements/features";
import { applyFeatureDependencies } from "@/lib/entitlements/feature-deps";
import { canAccessPublicRanking } from "./permissions";
import type { BoxEntitlements } from "@/lib/entitlements/types";

function entitlementsFromFeatures(
  features: ReturnType<typeof buildPlanFeatures>
): BoxEntitlements {
  return {
    features,
    featureDetails: [],
    subscription: { status: "active" },
  } as unknown as BoxEntitlements;
}

describe("public ranking access", () => {
  it("requires ranking and ranking_publico", () => {
    const pro = buildPlanFeatures("pro");
    expect(canAccessPublicRanking(entitlementsFromFeatures(pro))).toBe(true);

    const noRanking = { ...pro, ranking: false };
    expect(canAccessPublicRanking(entitlementsFromFeatures(noRanking))).toBe(
      false
    );

    const noPublic = { ...pro, ranking_publico: false };
    expect(canAccessPublicRanking(entitlementsFromFeatures(noPublic))).toBe(
      false
    );
  });

  it("blocks ranking_publico when ranking parent is off via dependencies", () => {
    const raw = buildPlanFeatures("pro");
    raw.ranking = false;
    raw.ranking_publico = true;
    const { effective } = applyFeatureDependencies(raw);
    expect(canAccessPublicRanking(entitlementsFromFeatures(effective))).toBe(
      false
    );
  });
});
