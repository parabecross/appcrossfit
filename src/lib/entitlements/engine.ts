import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  computeBoxEntitlements,
  wouldExceedPlanLimit,
} from "./compute";
import type { PlanCode, ResourceType } from "./features";
import { canAccessPublicRanking } from "./permissions";
import type {
  BoxEntitlements,
  BoxSubscriptionRow,
  BoxUsage,
  FeatureOverrideRow,
  SaasPlan,
} from "./types";
import { EntitlementError } from "./types";

export {
  OFFICIAL_PLAN_CATALOG,
  computeBoxEntitlements,
  resolveCanWrite,
  resolveEffectivePlanCode,
  resolveSubscriptionStatus,
  wouldExceedPlanLimit,
} from "./compute";

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

/**
 * Persiste vencimiento de promoción / gracia detectado en lectura
 * para no depender solo de un proceso manual.
 */
async function persistResolvedExpiry(
  subscription: BoxSubscriptionRow,
  resolvedStatus: BoxSubscriptionRow["status"]
) {
  if (
    resolvedStatus !== "expired" ||
    subscription.status === "expired" ||
    (subscription.status !== "trialing" &&
      subscription.status !== "grace_period")
  ) {
    return;
  }

  const admin = createAdminClient();
  await admin
    .from("box_subscriptions")
    .update({
      status: "expired",
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscription.id)
    .eq("status", subscription.status);
}

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
  const nowMs = Date.now();
  const [{ subscription, plan, overrides }, usage, allPlans] = await Promise.all([
    loadSubscription(boxId),
    getUsageForBox(boxId),
    loadPlans(),
  ]);

  const entitlements = computeBoxEntitlements({
    boxId,
    plan,
    subscription,
    usage,
    overrides,
    allPlans,
    nowMs,
  });

  // Best-effort: materializa vencimiento en DB (no bloquea la respuesta).
  void persistResolvedExpiry(subscription, entitlements.subscription.status);

  return entitlements;
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

function writeBlockedMessage(entitlements: BoxEntitlements): string {
  const status = entitlements.subscription.status;
  if (status === "suspended") {
    return "Tu box está suspendido. No puedes crear nuevos registros.";
  }
  if (status === "canceled") {
    return "Tu suscripción está cancelada. Reactiva o elige un plan para continuar.";
  }
  if (status === "expired") {
    return "Tu acceso finalizó. Elige un plan para continuar creando registros.";
  }
  return "Tu box no permite escritura en este estado.";
}

export function assertCanCreateResources(entitlements: BoxEntitlements) {
  if (!entitlements.canWrite) {
    throw new EntitlementError(writeBlockedMessage(entitlements));
  }
}

export function assertWithinPlanLimit(
  entitlements: BoxEntitlements,
  resource: ResourceType
) {
  assertCanCreateResources(entitlements);

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
  if (wouldExceedPlanLimit(used, max)) {
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
