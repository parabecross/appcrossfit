import type { ReactNode } from "react";
import { canUseFeature } from "@/lib/entitlements/permissions";
import type { BoxEntitlements } from "@/lib/entitlements/types";
import type { FeatureKey } from "@/lib/entitlements/features";
import { LockedFeatureCard } from "./locked-feature-card";
import { minPlanLabelForFeature } from "@/lib/entitlements/features";

export function FeatureGate({
  entitlements,
  featureKey,
  title,
  description,
  children,
}: {
  entitlements: BoxEntitlements;
  featureKey: FeatureKey;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  if (!canUseFeature(entitlements, featureKey)) {
    return (
      <LockedFeatureCard
        featureKey={featureKey}
        title={title}
        description={description}
        requiredPlanLabel={minPlanLabelForFeature(featureKey)}
      />
    );
  }
  return <>{children}</>;
}
