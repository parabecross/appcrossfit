import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  FEATURE_KEYS,
  type FeatureKey,
  type PlanCode,
  type ResourceType,
} from "./features";
import { enrichFeatureDetails } from "./feature-deps";
import { canAccessPublicRanking } from "./permissions";
import type {
  BoxEntitlements,
  BoxSubscriptionRow,
  BoxUsage,
  FeatureEntitlement,
  FeatureOverrideRow,
  SaasPlan,
} from "./types";
import { EntitlementError } from "./types";

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}

function activeOverrides(rows: FeatureOverrideRow[]): FeatureOverrideRow[] {
  const now = Date.now();
  return rows.filter((row) => {
    if (!row.expires_at) return true;
    return new Date(row.expires_at).getTime() > now;
  });
}

function resolveEffectivePlanCode(
  plan: SaasPlan,
  status: BoxSubscriptionRow["status"]
): PlanCode {
  if (status === "trialing") return "elite";
  return plan.code;
}

function buildFeatureMap(
  plan: SaasPlan,
  overrides: FeatureOverrideRow[],
  effectivePlanCode: PlanCode,
  allPlans: SaasPlan[]
): { features: Record<FeatureKey, boolean>; details: FeatureEntitlement[] } {
  const effectivePlan =
    allPlans.find((p) => p.code === effectivePlanCode) ?? plan;
  const base = effectivePlan.features;
  const active = activeOverrides(overrides);
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
      source: effectivePlanCode === "elite" && plan.code !== "elite" ? "promotional" : "plan",
    });
  }

  return { features, details };
}

export async function getUsageForBox(boxId: string): Promise<BoxUsage> {
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("rol, estado_cuenta")
    .eq("box_id", boxId);

  const rows = profiles ?? [];
  return {
    atletas: rows.filter((p) => p.rol === "socio" && p.estado_cuenta === "activo")
      .length,
    coaches: rows.filter((p) => p.rol === "coach").length,
    admins: rows.filter((p) => p.rol === "admin" || p.rol === "box_admin").length,
  };
}

async function loadPlans(): Promise<SaasPlan[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("plans").select("*").eq("is_active", true);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code as PlanCode,
    name: row.name,
    price_mxn: row.price_mxn,
    max_atletas: row.max_atletas,
    max_coaches: row.max_coaches,
    max_admins: row.max_admins,
    features: row.features as Record<string, boolean>,
  }));
}

async function ensureDefaultSubscription(
  boxId: string,
  startPlanId: string
): Promise<BoxSubscriptionRow> {
  const admin = createAdminClient();

  const { data: existing, error: selectError } = await admin
    .from("box_subscriptions")
    .select("*")
    .eq("box_id", boxId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing as BoxSubscriptionRow;

  const { error: insertError } = await admin.from("box_subscriptions").insert({
    box_id: boxId,
    plan_id: startPlanId,
    status: "active",
  });

  // Otro request concurrente pudo crear la fila primero (unique box_id).
  if (insertError && insertError.code !== "23505") {
    throw insertError;
  }

  const { data: subscription, error: fetchError } = await admin
    .from("box_subscriptions")
    .select("*")
    .eq("box_id", boxId)
    .single();

  if (fetchError || !subscription) {
    throw fetchError ?? new Error(`Suscripción no encontrada para box ${boxId}`);
  }

  return subscription as BoxSubscriptionRow;
}

type SubscriptionBundle = {
  subscription: BoxSubscriptionRow;
  plan: SaasPlan;
  overrides: FeatureOverrideRow[];
};

const subscriptionLoadCache = new Map<string, Promise<SubscriptionBundle>>();

async function loadSubscription(boxId: string): Promise<SubscriptionBundle> {
  const cached = subscriptionLoadCache.get(boxId);
  if (cached) return cached;

  const promise = (async () => {
    const admin = createAdminClient();
    const plans = await loadPlans();
    const startPlan = plans.find((p) => p.code === "start");
    if (!startPlan) throw new Error("Plan ATHRON Start no configurado");

    const subscription = await ensureDefaultSubscription(boxId, startPlan.id);
    const plan = plans.find((p) => p.id === subscription.plan_id) ?? startPlan;
    const { data: overrides, error: overridesError } = await admin
      .from("box_feature_overrides")
      .select("feature_key, enabled, reason, expires_at")
      .eq("box_id", boxId);

    if (overridesError) throw overridesError;

    return {
      subscription,
      plan,
      overrides: (overrides ?? []) as FeatureOverrideRow[],
    };
  })().finally(() => {
    subscriptionLoadCache.delete(boxId);
  });

  subscriptionLoadCache.set(boxId, promise);
  return promise;
}

export async function getBoxEntitlements(boxId: string): Promise<BoxEntitlements> {
  const [{ subscription, plan, overrides }, usage, allPlans] = await Promise.all([
    loadSubscription(boxId),
    getUsageForBox(boxId),
    loadPlans(),
  ]);

  const effectivePlanCode = resolveEffectivePlanCode(plan, subscription.status);
  const effectivePlan =
    allPlans.find((p) => p.code === effectivePlanCode) ?? plan;
  const { features, details } = buildFeatureMap(
    plan,
    overrides,
    effectivePlanCode,
    allPlans
  );

  const enriched = enrichFeatureDetails(features, details);

  const promotionalDaysRemaining =
    subscription.status === "trialing"
      ? daysUntil(subscription.trial_ends_at)
      : null;

  const canWrite = !["suspended", "canceled"].includes(subscription.status);

  return {
    boxId,
    plan,
    effectivePlanCode,
    subscription,
    usage,
    limits: {
      max_atletas: effectivePlan.max_atletas,
      max_coaches: effectivePlan.max_coaches,
      max_admins: effectivePlan.max_admins,
    },
    features: enriched.features,
    featureDetails: enriched.featureDetails,
    promotionalDaysRemaining,
    canWrite,
    isPromotional: subscription.status === "trialing",
  };
}

export { assertFeatureEnabled, canAccessPublicRanking, canUseFeature } from "./permissions";

export async function getPublicRankingAccess(boxSlug: string): Promise<{
  allowed: boolean;
  boxId: string | null;
}> {
  const admin = createAdminClient();
  const { data: box } = await admin
    .from("boxes")
    .select("id, status")
    .eq("slug", boxSlug)
    .maybeSingle();

  if (!box || box.status !== "active") {
    return { allowed: false, boxId: null };
  }

  const ent = await getBoxEntitlements(box.id);
  return {
    allowed: canAccessPublicRanking(ent),
    boxId: box.id,
  };
}

export async function getBoxSubscription(boxId: string) {
  return getBoxEntitlements(boxId);
}

export function assertCanCreateResources(entitlements: BoxEntitlements) {
  if (!entitlements.canWrite) {
    throw new EntitlementError(
      "Tu box está suspendido. No puedes crear nuevos registros."
    );
  }
  if (["expired", "canceled"].includes(entitlements.subscription.status)) {
    throw new EntitlementError(
      "Tu acceso finalizó. Elige un plan para continuar creando registros."
    );
  }
}

export function assertWithinPlanLimit(
  entitlements: BoxEntitlements,
  resource: ResourceType
) {
  if (!entitlements.canWrite) {
    throw new EntitlementError(
      "Tu box está suspendido. No puedes crear nuevos registros."
    );
  }
  if (["expired", "canceled"].includes(entitlements.subscription.status)) {
    throw new EntitlementError(
      "Tu acceso finalizó. Elige un plan para continuar creando registros."
    );
  }

  const map = {
    atletas: {
      max: entitlements.limits.max_atletas,
      used: entitlements.usage.atletas,
      label: "atletas activos",
    },
    coaches: {
      max: entitlements.limits.max_coaches,
      used: entitlements.usage.coaches,
      label: "coaches",
    },
    admins: {
      max: entitlements.limits.max_admins,
      used: entitlements.usage.admins,
      label: "administradores",
    },
  } as const;

  const { max, used, label } = map[resource];
  if (max != null && used >= max) {
    throw new EntitlementError(
      `Tu plan ${entitlements.plan.name} permite hasta ${max} ${label}. Actualiza tu plan para continuar.`
    );
  }
}

export async function getBoxEntitlementsForSession(boxId: string | null | undefined) {
  if (!boxId) throw new EntitlementError("Perfil sin box asignado", 400);
  return getBoxEntitlements(boxId);
}

export async function getBoxEntitlementsFromSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new EntitlementError("Unauthorized", 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("box_id")
    .eq("user_id", user.id)
    .single();

  return getBoxEntitlementsForSession(profile?.box_id);
}
