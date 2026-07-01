import { createAdminClient } from "@/lib/supabase/admin";
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  PLAN_LABELS,
  STATUS_LABELS_BOX,
  STATUS_LABELS_SUPER_ADMIN,
  type FeatureKey,
  type PlanCode,
  type SubscriptionStatus,
} from "@/lib/entitlements/features";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { getSuperAdminFeatureLabel } from "@/lib/entitlements/feature-deps";
import type { BoxEntitlements } from "@/lib/entitlements/types";

export type BoxSubscriptionSummary = {
  planCode: PlanCode;
  planName: string;
  displayPlanName: string;
  status: SubscriptionStatus;
  statusLabel: string;
  statusLabelSuperAdmin: string;
  priceMxn: number;
  athleteUsed: number;
  athleteLimit: number | null;
  coachUsed: number;
  coachLimit: number | null;
  adminUsed: number;
  adminLimit: number | null;
  promotionalDaysRemaining: number | null;
  periodEnd: string | null;
  trialEndsAt: string | null;
  isPromotional: boolean;
};

function displayPlanName(ent: BoxEntitlements): string {
  if (ent.isPromotional || ent.effectivePlanCode === "elite") {
    return PLAN_LABELS.elite;
  }
  return PLAN_LABELS[ent.plan.code];
}

export function toSubscriptionSummary(ent: BoxEntitlements): BoxSubscriptionSummary {
  const display = displayPlanName(ent);
  return {
    planCode: ent.effectivePlanCode,
    planName: ent.plan.name,
    displayPlanName: display,
    status: ent.subscription.status,
    statusLabel: STATUS_LABELS_BOX[ent.subscription.status],
    statusLabelSuperAdmin: STATUS_LABELS_SUPER_ADMIN[ent.subscription.status],
    priceMxn: ent.plan.price_mxn,
    athleteUsed: ent.usage.atletas,
    athleteLimit: ent.limits.max_atletas,
    coachUsed: ent.usage.coaches,
    coachLimit: ent.limits.max_coaches,
    adminUsed: ent.usage.admins,
    adminLimit: ent.limits.max_admins,
    promotionalDaysRemaining: ent.promotionalDaysRemaining,
    periodEnd: ent.subscription.current_period_end,
    trialEndsAt: ent.subscription.trial_ends_at,
    isPromotional: ent.isPromotional,
  };
}

export function serializeEntitlementsForSuperAdmin(ent: BoxEntitlements) {
  const summary = toSubscriptionSummary(ent);
  const enabled = FEATURE_KEYS.filter((k) => ent.features[k]);
  const blocked = FEATURE_KEYS.filter((k) => !ent.features[k]);

  return {
    ...summary,
    subscriptionId: ent.subscription.id,
    startedAt: ent.subscription.started_at,
    currentPeriodStart: ent.subscription.current_period_start,
    currentPeriodEnd: ent.subscription.current_period_end,
    graceEndsAt: ent.subscription.grace_ends_at,
    canceledAt: ent.subscription.canceled_at,
    notes: ent.subscription.notes,
    canWrite: ent.canWrite,
    features: ent.featureDetails.map((detail) => ({
      key: detail.key,
      label: FEATURE_LABELS[detail.key],
      enabled: detail.effectiveEnabled ?? detail.enabled,
      rawEnabled: detail.enabled,
      source: detail.source,
      blockedBy: detail.blockedBy ?? null,
      sourceLabel: getSuperAdminFeatureLabel(detail, ent),
    })),
    enabledFeatures: enabled,
    blockedFeatures: blocked,
  };
}

export function serializeEntitlementsForBox(ent: BoxEntitlements) {
  const summary = toSubscriptionSummary(ent);
  const enabled = FEATURE_KEYS.filter((k) => ent.features[k]);
  const blocked = FEATURE_KEYS.filter((k) => !ent.features[k]);

  return {
    plan: {
      code: ent.effectivePlanCode,
      name: summary.displayPlanName,
      priceMxn: ent.plan.price_mxn,
    },
    status: ent.subscription.status,
    statusLabel: summary.statusLabel,
    priceMxn: ent.plan.price_mxn,
    limits: ent.limits,
    usage: ent.usage,
    enabledFeatures: enabled,
    blockedFeatures: blocked,
    promotionalDaysRemaining: ent.promotionalDaysRemaining,
    periodEnd: ent.subscription.current_period_end,
    currentPeriodEnd: ent.subscription.current_period_end,
    isPromotional: ent.isPromotional,
    canWrite: ent.canWrite,
    displayPlanName: summary.displayPlanName,
  };
}

export async function getSubscriptionSummariesForBoxes(
  boxIds: string[]
): Promise<Map<string, BoxSubscriptionSummary>> {
  const map = new Map<string, BoxSubscriptionSummary>();
  await Promise.all(
    boxIds.map(async (boxId) => {
      const ent = await getBoxEntitlements(boxId);
      map.set(boxId, toSubscriptionSummary(ent));
    })
  );
  return map;
}

async function getPlanIdByCode(code: PlanCode): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("plans")
    .select("id")
    .eq("code", code)
    .single();
  if (error || !data) throw new Error(`Plan ${code} no encontrado`);
  return data.id;
}

export async function changeBoxPlan(boxId: string, planCode: PlanCode) {
  const admin = createAdminClient();
  const planId = await getPlanIdByCode(planCode);
  const { error } = await admin
    .from("box_subscriptions")
    .update({
      plan_id: planId,
      status: "active",
      trial_ends_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("box_id", boxId);
  if (error) throw error;
}

export async function updateBoxSubscription(
  boxId: string,
  patch: {
    planCode?: PlanCode;
    status?: SubscriptionStatus;
    currentPeriodEnd?: string | null;
    trialEndsAt?: string | null;
    graceEndsAt?: string | null;
    notes?: string | null;
  }
) {
  const admin = createAdminClient();
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.planCode) {
    update.plan_id = await getPlanIdByCode(patch.planCode);
  }
  if (patch.status) update.status = patch.status;
  if (patch.currentPeriodEnd !== undefined) {
    update.current_period_end = patch.currentPeriodEnd;
  }
  if (patch.trialEndsAt !== undefined) update.trial_ends_at = patch.trialEndsAt;
  if (patch.graceEndsAt !== undefined) update.grace_ends_at = patch.graceEndsAt;
  if (patch.notes !== undefined) update.notes = patch.notes;

  const { error } = await admin
    .from("box_subscriptions")
    .update(update)
    .eq("box_id", boxId);
  if (error) throw error;
}

export async function activatePromotionalAccess(boxId: string, days = 30) {
  const admin = createAdminClient();
  const planId = await getPlanIdByCode("elite");
  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + days);

  const { error } = await admin
    .from("box_subscriptions")
    .upsert(
      {
        box_id: boxId,
        plan_id: planId,
        status: "trialing",
        trial_ends_at: endsAt.toISOString(),
        current_period_end: endsAt.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "box_id" }
    );
  if (error) throw error;

  await admin
    .from("boxes")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", boxId);
}

export async function extendPromotionalAccess(boxId: string, days: number) {
  const ent = await getBoxEntitlements(boxId);
  const base = ent.subscription.trial_ends_at
    ? new Date(ent.subscription.trial_ends_at)
    : new Date();
  base.setDate(base.getDate() + days);
  await updateBoxSubscription(boxId, {
    status: "trialing",
    trialEndsAt: base.toISOString(),
    currentPeriodEnd: base.toISOString(),
  });
}

export async function suspendBoxSubscription(boxId: string) {
  await updateBoxSubscription(boxId, { status: "suspended" });
  const admin = createAdminClient();
  await admin
    .from("boxes")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("id", boxId);
}

export async function reactivateBoxSubscription(boxId: string) {
  await updateBoxSubscription(boxId, { status: "active" });
  const admin = createAdminClient();
  await admin
    .from("boxes")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", boxId);
}

export async function cancelBoxSubscription(boxId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("box_subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("box_id", boxId);
  if (error) throw error;
}

export async function setFeatureOverride(
  boxId: string,
  featureKey: FeatureKey,
  enabled: boolean,
  reason?: string | null
) {
  const admin = createAdminClient();
  const { error } = await admin.from("box_feature_overrides").upsert(
    {
      box_id: boxId,
      feature_key: featureKey,
      enabled,
      reason: reason ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "box_id,feature_key" }
  );
  if (error) throw error;
}

export async function removeFeatureOverride(boxId: string, featureKey: FeatureKey) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("box_feature_overrides")
    .delete()
    .eq("box_id", boxId)
    .eq("feature_key", featureKey);
  if (error) throw error;
}

export { FEATURE_LABELS } from "@/lib/entitlements/features";
