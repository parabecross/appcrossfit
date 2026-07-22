/**
 * Auditoría remota de planes ATHRON (solo lectura).
 *
 *   npm run audit:plans
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * NO modifica producción. Solo SELECT / reporta hallazgos.
 */

import * as dotenv from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import {
  OFFICIAL_PLAN_CATALOG,
  resolveSubscriptionStatus,
} from "../src/lib/entitlements/compute";
import {
  PRO_FEATURE_KEYS,
  START_FEATURE_KEYS,
  buildPlanFeatures,
} from "../src/lib/entitlements/features";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Check = { label: string; pass: boolean; detail: string };

function featureMatches(
  stored: Record<string, boolean>,
  expected: Record<string, boolean>
): string[] {
  const mismatches: string[] = [];
  for (const key of [...START_FEATURE_KEYS, ...PRO_FEATURE_KEYS]) {
    if (Boolean(stored[key]) !== Boolean(expected[key])) {
      mismatches.push(`${key}: got ${stored[key]} expected ${expected[key]}`);
    }
  }
  return mismatches;
}

async function main() {
  const checks: Check[] = [];
  const nowMs = Date.now();

  console.log("ATHRON plans audit (read-only)\n");

  const { data: plans, error: plansError } = await admin
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("code");

  if (plansError) {
    console.error("Failed to read plans:", plansError.message);
    process.exit(1);
  }

  for (const code of ["start", "pro", "elite"] as const) {
    const row = plans?.find((p) => p.code === code);
    const catalog = OFFICIAL_PLAN_CATALOG[code];
    if (!row) {
      checks.push({
        label: `plan ${code} exists`,
        pass: false,
        detail: "missing in Supabase",
      });
      continue;
    }
    const priceOk = row.price_mxn === catalog.price_mxn;
    const limitsOk =
      row.max_atletas === catalog.max_atletas &&
      row.max_coaches === catalog.max_coaches &&
      row.max_admins === catalog.max_admins;
    const expectedFeatures = buildPlanFeatures(code);
    const featMismatch = featureMatches(
      (row.features ?? {}) as Record<string, boolean>,
      expectedFeatures
    );

    checks.push({
      label: `plan ${code} price`,
      pass: priceOk,
      detail: priceOk
        ? `$${row.price_mxn}`
        : `got ${row.price_mxn} expected ${catalog.price_mxn}`,
    });
    checks.push({
      label: `plan ${code} limits`,
      pass: limitsOk,
      detail: limitsOk
        ? `${row.max_atletas}/${row.max_coaches}/${row.max_admins}`
        : `got ${row.max_atletas}/${row.max_coaches}/${row.max_admins}`,
    });
    checks.push({
      label: `plan ${code} features`,
      pass: featMismatch.length === 0,
      detail:
        featMismatch.length === 0
          ? "ok"
          : featMismatch.slice(0, 5).join("; "),
    });
  }

  const { data: subs, error: subsError } = await admin
    .from("box_subscriptions")
    .select(
      "id, box_id, status, trial_ends_at, grace_ends_at, canceled_at, plan_id, plans(code)"
    );

  if (subsError) {
    console.error("Failed to read subscriptions:", subsError.message);
    process.exit(1);
  }

  const byBox = new Map<string, number>();
  for (const s of subs ?? []) {
    byBox.set(s.box_id, (byBox.get(s.box_id) ?? 0) + 1);
  }
  const multi = [...byBox.entries()].filter(([, n]) => n > 1);
  checks.push({
    label: "one subscription per box",
    pass: multi.length === 0,
    detail:
      multi.length === 0
        ? `${byBox.size} boxes`
        : `duplicates: ${multi.map(([id, n]) => `${id}×${n}`).join(", ")}`,
  });

  const stalePromo = (subs ?? []).filter((s) => {
    if (s.status !== "trialing") return false;
    return (
      resolveSubscriptionStatus(
        {
          status: s.status,
          trial_ends_at: s.trial_ends_at,
          grace_ends_at: s.grace_ends_at,
        },
        nowMs
      ) === "expired"
    );
  });
  checks.push({
    label: "no expired promos still marked trialing",
    pass: stalePromo.length === 0,
    detail:
      stalePromo.length === 0
        ? "ok"
        : stalePromo.map((s) => s.box_id).join(", "),
  });

  const canceledMissingAt = (subs ?? []).filter(
    (s) => s.status === "canceled" && !s.canceled_at
  );
  checks.push({
    label: "canceled subscriptions have canceled_at",
    pass: canceledMissingAt.length === 0,
    detail:
      canceledMissingAt.length === 0
        ? "ok"
        : canceledMissingAt.map((s) => s.box_id).join(", "),
  });

  // Uso vs límite (solo lectura)
  const { data: profiles } = await admin
    .from("profiles")
    .select("box_id, rol, estado_cuenta");

  const usageByBox = new Map<
    string,
    { atletas: number; coaches: number; admins: number }
  >();
  for (const p of profiles ?? []) {
    if (!p.box_id) continue;
    const u = usageByBox.get(p.box_id) ?? {
      atletas: 0,
      coaches: 0,
      admins: 0,
    };
    if (p.rol === "socio" && p.estado_cuenta === "activo") u.atletas += 1;
    if (p.rol === "coach") u.coaches += 1;
    if (p.rol === "admin" || p.rol === "box_admin") u.admins += 1;
    usageByBox.set(p.box_id, u);
  }

  const planById = new Map((plans ?? []).map((p) => [p.id, p]));
  const overLimit: string[] = [];
  for (const s of subs ?? []) {
    const plan = planById.get(s.plan_id);
    if (!plan) continue;
    const resolved = resolveSubscriptionStatus(
      {
        status: s.status,
        trial_ends_at: s.trial_ends_at,
        grace_ends_at: s.grace_ends_at,
      },
      nowMs
    );
    // Durante promo vigente se usan límites Elite.
    const effectiveCode =
      resolved === "trialing" ? "elite" : (plan.code as keyof typeof OFFICIAL_PLAN_CATALOG);
    const catalog = OFFICIAL_PLAN_CATALOG[effectiveCode];
    if (!catalog) continue;
    const usage = usageByBox.get(s.box_id) ?? {
      atletas: 0,
      coaches: 0,
      admins: 0,
    };
    const overAth =
      catalog.max_atletas != null && usage.atletas > catalog.max_atletas;
    const overCoach =
      catalog.max_coaches != null && usage.coaches > catalog.max_coaches;
    const overAdmin =
      catalog.max_admins != null && usage.admins > catalog.max_admins;
    if (overAth || overCoach || overAdmin) {
      overLimit.push(
        `${s.box_id} (${effectiveCode}): a=${usage.atletas}/${catalog.max_atletas} c=${usage.coaches}/${catalog.max_coaches} adm=${usage.admins}/${catalog.max_admins}`
      );
    }
  }
  checks.push({
    label: "boxes within effective plan limits (or flagged over)",
    pass: true, // informativo: over-limit se permite al bajar de plan
    detail:
      overLimit.length === 0
        ? "none over limit"
        : `OVER LIMIT (retained users OK): ${overLimit.slice(0, 10).join(" | ")}`,
  });

  let failed = 0;
  for (const c of checks) {
    const mark = c.pass ? "PASS" : "FAIL";
    if (!c.pass) failed += 1;
    console.log(`[${mark}] ${c.label} — ${c.detail}`);
  }

  console.log(
    `\n${checks.length - failed}/${checks.length} checks passed (read-only; no writes).`
  );

  // SQL de verificación remota (para pegar en SQL Editor)
  console.log(`
── SQL de verificación remota (solo lectura) ──────────────────────────────────
-- 1) Planes
SELECT code, name, price_mxn, max_atletas, max_coaches, max_admins, features
FROM plans WHERE is_active = true ORDER BY code;

-- 2) Una suscripción por box
SELECT box_id, COUNT(*) AS n
FROM box_subscriptions
GROUP BY box_id
HAVING COUNT(*) > 1;

-- 3) Promos vencidas aún trialing
SELECT box_id, status, trial_ends_at
FROM box_subscriptions
WHERE status = 'trialing' AND trial_ends_at IS NOT NULL AND trial_ends_at <= now();

-- 4) Canceladas sin canceled_at
SELECT box_id, status, canceled_at
FROM box_subscriptions
WHERE status = 'canceled' AND canceled_at IS NULL;
───────────────────────────────────────────────────────────────────────────────
`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
