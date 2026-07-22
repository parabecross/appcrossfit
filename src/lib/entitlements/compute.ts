import {
  FEATURE_KEYS,
  type FeatureKey,
  type PlanCode,
  type SubscriptionStatus,
} from "./features";
import { enrichFeatureDetails } from "./feature-deps";
import type {
  BoxEntitlements,
  BoxSubscriptionRow,
  BoxUsage,
  FeatureEntitlement,
  FeatureOverrideRow,
  SaasPlan,
} from "./types";

/** Catálogo oficial ATHRON (fuente de verdad de negocio / tests). */
export const OFFICIAL_PLAN_CATALOG = {
  start: {
    code: "start" as const,
    name: "ATHRON Start",
    price_mxn: 899,
    max_atletas: 50,
    max_coaches: 2,
    max_admins: 1,
  },
  pro: {
    code: "pro" as const,
    name: "ATHRON Pro",
    price_mxn: 1099,
    max_atletas: 75,
    max_coaches: 5,
    max_admins: 2,
  },
  elite: {
    code: "elite" as const,
    name: "ATHRON Elite",
    price_mxn: 1299,
    max_atletas: 150,
    max_coaches: null as number | null,
    max_admins: null as number | null,
  },
};

export function daysUntilIso(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  return Math.max(0, Math.ceil((end - nowMs) / (1000 * 60 * 60 * 24)));
}

export function isIsoInPast(iso: string | null, nowMs: number): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() <= nowMs;
}

/**
 * Estado efectivo de la suscripción.
 * - Promoción (`trialing`) vencida → `expired` (sin depender de un proceso manual).
 * - `grace_period` vencido → `expired`.
 */
export function resolveSubscriptionStatus(
  subscription: Pick<
    BoxSubscriptionRow,
    "status" | "trial_ends_at" | "grace_ends_at"
  >,
  nowMs: number = Date.now()
): SubscriptionStatus {
  if (
    subscription.status === "trialing" &&
    isIsoInPast(subscription.trial_ends_at, nowMs)
  ) {
    return "expired";
  }
  if (
    subscription.status === "grace_period" &&
    isIsoInPast(subscription.grace_ends_at, nowMs)
  ) {
    return "expired";
  }
  return subscription.status;
}

/**
 * Escrituras permitidas solo en active | trialing (vigente) | grace_period (vigente).
 * expired / suspended / canceled → solo lectura (según canUseFeature).
 */
export function resolveCanWrite(status: SubscriptionStatus): boolean {
  return (
    status === "active" ||
    status === "trialing" ||
    status === "grace_period"
  );
}

export function resolveEffectivePlanCode(
  planCode: PlanCode,
  resolvedStatus: SubscriptionStatus
): PlanCode {
  if (resolvedStatus === "trialing") return "elite";
  return planCode;
}

function activeOverrides(
  rows: FeatureOverrideRow[],
  nowMs: number
): FeatureOverrideRow[] {
  return rows.filter((row) => {
    if (!row.expires_at) return true;
    return new Date(row.expires_at).getTime() > nowMs;
  });
}

export function buildFeatureMap(
  plan: SaasPlan,
  overrides: FeatureOverrideRow[],
  effectivePlanCode: PlanCode,
  allPlans: SaasPlan[],
  nowMs: number = Date.now()
): { features: Record<FeatureKey, boolean>; details: FeatureEntitlement[] } {
  const effectivePlan =
    allPlans.find((p) => p.code === effectivePlanCode) ?? plan;
  const base = effectivePlan.features;
  const active = activeOverrides(overrides, nowMs);
  const features = {} as Record<FeatureKey, boolean>;
  const details: FeatureEntitlement[] = [];

  for (const key of FEATURE_KEYS) {
    const override = active.find((o) => o.feature_key === key);
    if (override) {
      features[key] = override.enabled;
      details.push({ key, enabled: override.enabled, source: "override" });
      continue;
    }
    const enabled = Boolean(base[key]);
    features[key] = enabled;
    details.push({
      key,
      enabled,
      source:
        effectivePlanCode === "elite" && plan.code !== "elite"
          ? "promotional"
          : "plan",
    });
  }

  return { features, details };
}

export type ComputeEntitlementsInput = {
  boxId: string;
  plan: SaasPlan;
  subscription: BoxSubscriptionRow;
  usage: BoxUsage;
  overrides: FeatureOverrideRow[];
  allPlans: SaasPlan[];
  nowMs?: number;
};

/**
 * Motor puro de entitlements (testeable sin Supabase).
 */
export function computeBoxEntitlements(
  input: ComputeEntitlementsInput
): BoxEntitlements {
  const nowMs = input.nowMs ?? Date.now();
  const { boxId, plan, subscription, usage, overrides, allPlans } = input;

  const resolvedStatus = resolveSubscriptionStatus(subscription, nowMs);
  const effectivePlanCode = resolveEffectivePlanCode(plan.code, resolvedStatus);
  const effectivePlan =
    allPlans.find((p) => p.code === effectivePlanCode) ?? plan;

  const { features, details } = buildFeatureMap(
    plan,
    overrides,
    effectivePlanCode,
    allPlans,
    nowMs
  );
  const enriched = enrichFeatureDetails(features, details);

  const isPromotional = resolvedStatus === "trialing";
  const promotionalDaysRemaining = isPromotional
    ? daysUntilIso(subscription.trial_ends_at, nowMs)
    : null;

  return {
    boxId,
    plan,
    effectivePlanCode,
    subscription: {
      ...subscription,
      // Exponer estado efectivo para asserts / UI (promoción o gracia vencidas).
      status: resolvedStatus,
    },
    usage,
    limits: {
      max_atletas: effectivePlan.max_atletas,
      max_coaches: effectivePlan.max_coaches,
      max_admins: effectivePlan.max_admins,
    },
    features: enriched.features,
    featureDetails: enriched.featureDetails,
    promotionalDaysRemaining,
    canWrite: resolveCanWrite(resolvedStatus),
    isPromotional,
  };
}

/** Base de extensión/activación de promo: nunca desde una fecha ya vencida. */
export function promotionalEndBase(
  trialEndsAt: string | null,
  nowMs: number = Date.now()
): Date {
  if (trialEndsAt) {
    const existing = new Date(trialEndsAt).getTime();
    if (existing > nowMs) return new Date(existing);
  }
  return new Date(nowMs);
}

export function addDaysIso(base: Date, days: number): string {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function wouldExceedPlanLimit(
  used: number,
  max: number | null | undefined
): boolean {
  if (max == null) return false;
  return used >= max;
}
