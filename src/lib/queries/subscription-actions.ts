import type { PlanCode, SubscriptionStatus } from "@/lib/entitlements/features";

/**
 * Decide qué operación de suscripción aplica el Super Admin.
 * Extraído para pruebas de integración sin HTTP/auth.
 */
export type SuperAdminSubscriptionAction =
  | { type: "cancel" }
  | { type: "change_plan"; planCode: PlanCode }
  | {
      type: "patch";
      status?: SubscriptionStatus;
      currentPeriodEnd?: string | null;
      trialEndsAt?: string | null;
      graceEndsAt?: string | null;
      notes?: string | null;
    };

export function resolveSuperAdminSubscriptionAction(body: {
  planCode?: PlanCode;
  status?: SubscriptionStatus;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  graceEndsAt?: string | null;
  notes?: string | null;
}): SuperAdminSubscriptionAction {
  if (body.status === "canceled" && !body.planCode) {
    return { type: "cancel" };
  }
  if (body.planCode) {
    return { type: "change_plan", planCode: body.planCode };
  }
  return {
    type: "patch",
    status: body.status,
    currentPeriodEnd: body.currentPeriodEnd,
    trialEndsAt: body.trialEndsAt,
    graceEndsAt: body.graceEndsAt,
    notes: body.notes,
  };
}
