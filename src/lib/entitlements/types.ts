import type {
  FeatureKey,
  PlanCode,
  SubscriptionStatus,
} from "./features";

export type SaasPlan = {
  id: string;
  code: PlanCode;
  name: string;
  price_mxn: number;
  max_atletas: number | null;
  max_coaches: number | null;
  max_admins: number | null;
  features: Record<string, boolean>;
};

export type BoxSubscriptionRow = {
  id: string;
  box_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  started_at: string;
  current_period_start: string;
  current_period_end: string | null;
  trial_ends_at: string | null;
  grace_ends_at: string | null;
  canceled_at: string | null;
  notes: string | null;
};

export type FeatureOverrideRow = {
  feature_key: string;
  enabled: boolean;
  reason: string | null;
  expires_at: string | null;
};

export type BoxUsage = {
  atletas: number;
  coaches: number;
  admins: number;
};

export type FeatureSource = "plan" | "override" | "promotional";

export type FeatureEntitlement = {
  key: FeatureKey;
  /** Valor del plan u override, antes de dependencias. */
  enabled: boolean;
  /** Valor efectivo tras aplicar dependencias padre → hijo. */
  effectiveEnabled?: boolean;
  source: FeatureSource;
  /** Padre que bloquea esta función cuando está apagado. */
  blockedBy?: FeatureKey;
};

export type BoxEntitlements = {
  boxId: string;
  plan: SaasPlan;
  effectivePlanCode: PlanCode;
  subscription: BoxSubscriptionRow;
  usage: BoxUsage;
  limits: {
    max_atletas: number | null;
    max_coaches: number | null;
    max_admins: number | null;
  };
  features: Record<FeatureKey, boolean>;
  featureDetails: FeatureEntitlement[];
  promotionalDaysRemaining: number | null;
  canWrite: boolean;
  isPromotional: boolean;
};

export class EntitlementError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}
