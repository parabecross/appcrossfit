import { describe, expect, it } from "vitest";
import {
  OFFICIAL_PLAN_CATALOG,
  addDaysIso,
  computeBoxEntitlements,
  promotionalEndBase,
  resolveCanWrite,
  resolveSubscriptionStatus,
  wouldExceedPlanLimit,
} from "./compute";
import {
  PRO_FEATURE_KEYS,
  START_FEATURE_KEYS,
  buildPlanFeatures,
} from "./features";
import {
  assertCanCreateResources,
  assertWithinPlanLimit,
} from "./engine";
import { assertFeatureEnabled, canUseFeature } from "./permissions";
import { EntitlementError, type BoxSubscriptionRow, type SaasPlan } from "./types";
import { toSubscriptionSummary } from "@/lib/queries/subscriptions";
import { resolveSuperAdminSubscriptionAction } from "@/lib/queries/subscription-actions";

function makePlan(code: keyof typeof OFFICIAL_PLAN_CATALOG): SaasPlan {
  const cat = OFFICIAL_PLAN_CATALOG[code];
  return {
    id: `plan-${code}`,
    code: cat.code,
    name: cat.name,
    price_mxn: cat.price_mxn,
    max_atletas: cat.max_atletas,
    max_coaches: cat.max_coaches,
    max_admins: cat.max_admins,
    features: buildPlanFeatures(cat.code),
  };
}

const ALL_PLANS = [
  makePlan("start"),
  makePlan("pro"),
  makePlan("elite"),
];

function sub(
  overrides: Partial<BoxSubscriptionRow> & { planCode?: keyof typeof OFFICIAL_PLAN_CATALOG } = {}
): { subscription: BoxSubscriptionRow; plan: SaasPlan } {
  const planCode = overrides.planCode ?? "start";
  const plan = makePlan(planCode);
  const rest = { ...overrides };
  delete rest.planCode;
  return {
    plan,
    subscription: {
      id: "sub-1",
      box_id: "box-1",
      plan_id: plan.id,
      status: "active",
      started_at: "2026-01-01T00:00:00.000Z",
      current_period_start: "2026-01-01T00:00:00.000Z",
      current_period_end: null,
      trial_ends_at: null,
      grace_ends_at: null,
      canceled_at: null,
      notes: null,
      ...rest,
    },
  };
}

function entFor(
  planCode: keyof typeof OFFICIAL_PLAN_CATALOG,
  usage: { atletas: number; coaches: number; admins: number },
  subOverrides: Partial<BoxSubscriptionRow> = {},
  nowMs = Date.parse("2026-07-22T18:00:00.000Z")
) {
  const { plan, subscription } = sub({ planCode, ...subOverrides });
  return computeBoxEntitlements({
    boxId: "box-1",
    plan,
    subscription,
    usage,
    overrides: [],
    allPlans: ALL_PLANS,
    nowMs,
  });
}

describe("official plan catalog", () => {
  it("matches START / PRO / ELITE prices and limits", () => {
    expect(OFFICIAL_PLAN_CATALOG.start).toMatchObject({
      price_mxn: 899,
      max_atletas: 50,
      max_coaches: 2,
      max_admins: 1,
    });
    expect(OFFICIAL_PLAN_CATALOG.pro).toMatchObject({
      price_mxn: 1099,
      max_atletas: 75,
      max_coaches: 5,
      max_admins: 2,
    });
    expect(OFFICIAL_PLAN_CATALOG.elite).toMatchObject({
      price_mxn: 1299,
      max_atletas: 150,
      max_coaches: null,
      max_admins: null,
    });
  });
});

describe("START plan", () => {
  it("allows up to 50 athletes and rejects 51st", () => {
    const at50 = entFor("start", { atletas: 50, coaches: 0, admins: 1 });
    expect(() => assertWithinPlanLimit(at50, "atletas")).toThrow(EntitlementError);
    const at49 = entFor("start", { atletas: 49, coaches: 0, admins: 1 });
    expect(() => assertWithinPlanLimit(at49, "atletas")).not.toThrow();
  });

  it("allows 2 coaches and rejects 3rd", () => {
    const at2 = entFor("start", { atletas: 0, coaches: 2, admins: 1 });
    expect(() => assertWithinPlanLimit(at2, "coaches")).toThrow(EntitlementError);
    const at1 = entFor("start", { atletas: 0, coaches: 1, admins: 1 });
    expect(() => assertWithinPlanLimit(at1, "coaches")).not.toThrow();
  });

  it("allows 1 admin and rejects 2nd", () => {
    const at1 = entFor("start", { atletas: 0, coaches: 0, admins: 1 });
    expect(() => assertWithinPlanLimit(at1, "admins")).toThrow(EntitlementError);
  });

  it("blocks ranking / progreso / estadísticas; allows base modules", () => {
    const ent = entFor("start", { atletas: 0, coaches: 0, admins: 1 });
    for (const key of START_FEATURE_KEYS) {
      expect(canUseFeature(ent, key)).toBe(true);
      expect(() => assertFeatureEnabled(ent, key)).not.toThrow();
    }
    for (const key of ["ranking", "progreso_atleta", "estadisticas_avanzadas"] as const) {
      expect(canUseFeature(ent, key)).toBe(false);
      expect(() => assertFeatureEnabled(ent, key)).toThrow(EntitlementError);
    }
  });
});

describe("PRO plan", () => {
  it("allows 75 athletes and rejects 76th", () => {
    expect(() =>
      assertWithinPlanLimit(
        entFor("pro", { atletas: 75, coaches: 0, admins: 1 }),
        "atletas"
      )
    ).toThrow(EntitlementError);
    expect(() =>
      assertWithinPlanLimit(
        entFor("pro", { atletas: 74, coaches: 0, admins: 1 }),
        "atletas"
      )
    ).not.toThrow();
  });

  it("allows 5 coaches and 2 admins", () => {
    expect(() =>
      assertWithinPlanLimit(
        entFor("pro", { atletas: 0, coaches: 5, admins: 1 }),
        "coaches"
      )
    ).toThrow();
    expect(() =>
      assertWithinPlanLimit(
        entFor("pro", { atletas: 0, coaches: 4, admins: 2 }),
        "admins"
      )
    ).toThrow();
    expect(() =>
      assertWithinPlanLimit(
        entFor("pro", { atletas: 0, coaches: 4, admins: 1 }),
        "coaches"
      )
    ).not.toThrow();
  });

  it("enables ranking, progreso and estadísticas", () => {
    const ent = entFor("pro", { atletas: 0, coaches: 0, admins: 1 });
    for (const key of PRO_FEATURE_KEYS) {
      expect(canUseFeature(ent, key)).toBe(true);
    }
  });
});

describe("ELITE plan", () => {
  it("allows 150 athletes and rejects 151st; unlimited coaches/admins", () => {
    expect(() =>
      assertWithinPlanLimit(
        entFor("elite", { atletas: 150, coaches: 99, admins: 99 }),
        "atletas"
      )
    ).toThrow();
    expect(() =>
      assertWithinPlanLimit(
        entFor("elite", { atletas: 149, coaches: 99, admins: 99 }),
        "coaches"
      )
    ).not.toThrow();
    expect(() =>
      assertWithinPlanLimit(
        entFor("elite", { atletas: 149, coaches: 99, admins: 99 }),
        "admins"
      )
    ).not.toThrow();
  });

  it("enables all features", () => {
    const ent = entFor("elite", { atletas: 0, coaches: 0, admins: 1 });
    for (const key of [...START_FEATURE_KEYS, ...PRO_FEATURE_KEYS]) {
      expect(ent.features[key]).toBe(true);
    }
  });
});

describe("plan changes and over-limit boxes", () => {
  it("Start→Pro and Pro→Elite raise limits immediately", () => {
    const start = entFor("start", { atletas: 50, coaches: 2, admins: 1 });
    expect(start.limits.max_atletas).toBe(50);
    const pro = entFor("pro", { atletas: 50, coaches: 2, admins: 1 });
    expect(pro.limits.max_atletas).toBe(75);
    expect(pro.features.ranking).toBe(true);
    const elite = entFor("elite", { atletas: 80, coaches: 10, admins: 5 });
    expect(elite.limits.max_atletas).toBe(150);
    expect(elite.limits.max_coaches).toBeNull();
  });

  it("Elite→Start keeps existing users over limit but blocks new creates", () => {
    const ent = entFor("start", { atletas: 80, coaches: 10, admins: 3 });
    expect(ent.usage.atletas).toBe(80);
    expect(() => assertWithinPlanLimit(ent, "atletas")).toThrow(EntitlementError);
  });
});

describe("subscription statuses / canWrite", () => {
  it("defines canWrite for all statuses", () => {
    expect(resolveCanWrite("active")).toBe(true);
    expect(resolveCanWrite("trialing")).toBe(true);
    expect(resolveCanWrite("grace_period")).toBe(true);
    expect(resolveCanWrite("expired")).toBe(false);
    expect(resolveCanWrite("suspended")).toBe(false);
    expect(resolveCanWrite("canceled")).toBe(false);
  });

  it("blocks writes when suspended, canceled or expired", () => {
    for (const status of ["suspended", "canceled", "expired"] as const) {
      const ent = entFor("pro", { atletas: 0, coaches: 0, admins: 1 }, { status });
      expect(ent.canWrite).toBe(false);
      expect(() => assertCanCreateResources(ent)).toThrow(EntitlementError);
      expect(() => assertFeatureEnabled(ent, "ranking")).toThrow(EntitlementError);
    }
  });

  it("grace_period allows writes with plan features", () => {
    const ent = entFor(
      "pro",
      { atletas: 0, coaches: 0, admins: 1 },
      {
        status: "grace_period",
        grace_ends_at: "2026-08-01T00:00:00.000Z",
      }
    );
    expect(ent.canWrite).toBe(true);
    expect(ent.features.ranking).toBe(true);
  });

  it("expired grace_period becomes expired and blocks writes", () => {
    const ent = entFor(
      "pro",
      { atletas: 0, coaches: 0, admins: 1 },
      {
        status: "grace_period",
        grace_ends_at: "2026-07-01T00:00:00.000Z",
      }
    );
    expect(ent.subscription.status).toBe("expired");
    expect(ent.canWrite).toBe(false);
  });
});

describe("promotional access", () => {
  const now = Date.parse("2026-07-22T18:00:00.000Z");

  it("trialing uses Elite limits/features while commercial plan stays Start", () => {
    const ent = entFor(
      "start",
      { atletas: 60, coaches: 3, admins: 2 },
      {
        status: "trialing",
        trial_ends_at: "2026-08-01T00:00:00.000Z",
      },
      now
    );
    expect(ent.isPromotional).toBe(true);
    expect(ent.effectivePlanCode).toBe("elite");
    expect(ent.plan.code).toBe("start");
    expect(ent.limits.max_atletas).toBe(150);
    expect(ent.features.ranking).toBe(true);
    expect(ent.promotionalDaysRemaining).toBeGreaterThan(0);
    const summary = toSubscriptionSummary(ent);
    expect(summary.displayPlanName).toContain("promocional");
    expect(summary.priceMxn).toBe(899);
  });

  it("expired promo does not keep effectivePlanCode=elite", () => {
    const ent = entFor(
      "start",
      { atletas: 0, coaches: 0, admins: 1 },
      {
        status: "trialing",
        trial_ends_at: "2026-07-01T00:00:00.000Z",
      },
      now
    );
    expect(resolveSubscriptionStatus(ent.subscription, now)).toBe("expired");
    expect(ent.subscription.status).toBe("expired");
    expect(ent.effectivePlanCode).toBe("start");
    expect(ent.isPromotional).toBe(false);
    expect(ent.features.ranking).toBe(false);
    expect(ent.canWrite).toBe(false);
  });

  it("extending from a past trial date starts from now", () => {
    const past = "2026-07-01T00:00:00.000Z";
    const base = promotionalEndBase(past, now);
    expect(base.getTime()).toBe(now);
    const ends = addDaysIso(base, 30);
    expect(new Date(ends).getTime()).toBeGreaterThan(now);
  });

  it("extending an active promo adds days to remaining end", () => {
    const future = "2026-08-01T00:00:00.000Z";
    const base = promotionalEndBase(future, now);
    expect(base.toISOString()).toBe(future);
  });
});

describe("Super Admin subscription actions", () => {
  it("cancel uses dedicated cancel action (sets canceled_at path)", () => {
    expect(resolveSuperAdminSubscriptionAction({ status: "canceled" })).toEqual({
      type: "cancel",
    });
  });

  it("plan change uses change_plan (clears lifecycle fields)", () => {
    expect(
      resolveSuperAdminSubscriptionAction({ planCode: "pro", status: "active" })
    ).toEqual({ type: "change_plan", planCode: "pro" });
  });

  it("reactivate/suspend/notes use patch", () => {
    expect(resolveSuperAdminSubscriptionAction({ status: "suspended" }).type).toBe(
      "patch"
    );
    expect(resolveSuperAdminSubscriptionAction({ notes: "x" }).type).toBe("patch");
  });
});

describe("wouldExceedPlanLimit", () => {
  it("null max never exceeds", () => {
    expect(wouldExceedPlanLimit(999, null)).toBe(false);
  });
  it("blocks at equality", () => {
    expect(wouldExceedPlanLimit(50, 50)).toBe(true);
    expect(wouldExceedPlanLimit(49, 50)).toBe(false);
  });
});
