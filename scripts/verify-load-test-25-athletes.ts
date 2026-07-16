/**
 * Verificación del escenario load-test-25.
 *
 *   ATHRON_LOAD_TEST_CONFIRM=true npm run loadtest:25:verify
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EntitlementError,
} from "../src/lib/entitlements/types";
import { assertWithinPlanLimit } from "../src/lib/entitlements/engine";
import type { BoxEntitlements } from "../src/lib/entitlements/types";
import { ACTIVE_RESERVA_ESTADOS } from "../src/lib/reservas/helpers";
import {
  LOAD_TEST_ADMIN_EMAIL,
  LOAD_TEST_COACH_EMAILS,
  LOAD_TEST_EMAIL_PREFIX,
  LOAD_TEST_NOTES,
  LOAD_TEST_SLUG,
  LOAD_TEST_TARGET_ATHLETES,
  athleteEmail,
  allLoadTestEmails,
} from "./lib/load-test-25-constants";
import {
  listAuthUsersByEmail,
  requireLoadTestBox,
  requireLoadTestEnv,
} from "./lib/load-test-25-env";

type Check = { label: string; pass: boolean; detail: string };

const checks: Check[] = [];

function add(label: string, pass: boolean, detail: string) {
  checks.push({ label, pass, detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${label} — ${detail}`);
}

async function profileIdsForEmails(
  service: SupabaseClient,
  emails: string[]
): Promise<Map<string, { id: string; box_id: string | null; rol: string }>> {
  const auth = await listAuthUsersByEmail(service);
  const map = new Map<
    string,
    { id: string; box_id: string | null; rol: string }
  >();

  for (const email of emails) {
    const authId = auth.get(email.toLowerCase());
    if (!authId) continue;
    const { data, error } = await service
      .from("profiles")
      .select("id, box_id, rol, estado_cuenta")
      .eq("user_id", authId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      map.set(email.toLowerCase(), {
        id: data.id,
        box_id: data.box_id,
        rol: data.rol,
      });
    }
  }
  return map;
}

async function getUsageAtletas(
  service: SupabaseClient,
  boxId: string
): Promise<number> {
  const { data, error } = await service
    .from("profiles")
    .select("rol, estado_cuenta")
    .eq("box_id", boxId);
  if (error) throw error;
  return (data ?? []).filter(
    (p) => p.rol === "socio" && p.estado_cuenta === "activo"
  ).length;
}

/**
 * Clamp temporal del límite SaaS del plan Pro a 25 solo para probar
 * assertWithinPlanLimit (mecanismo real). Restaura en finally.
 */
async function withTemporaryAthleteLimit<T>(
  service: SupabaseClient,
  planId: string,
  limit: number,
  fn: () => Promise<T>
): Promise<T> {
  const { data: plan, error } = await service
    .from("plans")
    .select("id, max_atletas")
    .eq("id", planId)
    .single();
  if (error || !plan) throw new Error(`Plan lookup: ${error?.message}`);

  const original = plan.max_atletas;
  const { error: updErr } = await service
    .from("plans")
    .update({ max_atletas: limit })
    .eq("id", planId);
  if (updErr) throw new Error(`plans clamp: ${updErr.message}`);

  try {
    return await fn();
  } finally {
    const { error: restoreErr } = await service
      .from("plans")
      .update({ max_atletas: original })
      .eq("id", planId);
    if (restoreErr) {
      console.error(
        `CRITICAL: no se pudo restaurar plans.max_atletas a ${original}: ${restoreErr.message}`
      );
    }
  }
}

async function main() {
  const { service } = requireLoadTestEnv();
  const box = await requireLoadTestBox(service);

  if (box.slug !== LOAD_TEST_SLUG) {
    console.error("FAIL — slug incorrecto");
    process.exit(1);
  }

  console.log(`ATHRON load-test-25 — verify (${box.id})\n`);

  const emails = allLoadTestEmails();
  for (const e of emails) {
    if (!e.toLowerCase().startsWith(LOAD_TEST_EMAIL_PREFIX)) {
      add("email prefix", false, e);
      console.error("\nFAIL");
      process.exit(1);
    }
  }

  const profiles = await profileIdsForEmails(service, emails);

  const { data: boxProfiles, error: bpErr } = await service
    .from("profiles")
    .select("id, rol, user_id, estado_cuenta")
    .eq("box_id", box.id);
  if (bpErr) throw bpErr;

  const socios = (boxProfiles ?? []).filter((p) => p.rol === "socio");
  const coaches = (boxProfiles ?? []).filter((p) => p.rol === "coach");
  const admins = (boxProfiles ?? []).filter(
    (p) => p.rol === "admin" || p.rol === "box_admin"
  );

  add(
    "exactamente 25 socios",
    socios.length === LOAD_TEST_TARGET_ATHLETES,
    `count=${socios.length}`
  );
  add("exactamente 2 coaches", coaches.length === 2, `count=${coaches.length}`);
  add("exactamente 1 admin", admins.length === 1, `count=${admins.length}`);

  const adminProf = profiles.get(LOAD_TEST_ADMIN_EMAIL.toLowerCase());
  add(
    "admin en box correcto",
    !!adminProf && adminProf.box_id === box.id && adminProf.rol === "admin",
    adminProf?.box_id ?? "missing"
  );

  for (const email of LOAD_TEST_COACH_EMAILS) {
    const p = profiles.get(email.toLowerCase());
    add(
      `coach ${email}`,
      !!p && p.box_id === box.id && p.rol === "coach",
      p?.box_id ?? "missing"
    );
  }

  let foreignLink = false;
  for (const email of emails) {
    const p = profiles.get(email.toLowerCase());
    if (p && p.box_id && p.box_id !== box.id) {
      foreignLink = true;
      add(`aislamiento ${email}`, false, `box_id=${p.box_id}`);
    }
  }
  if (!foreignLink) {
    add("ningún loadtest25 en otro box", true, "ok");
  }

  const { data: sub } = await service
    .from("box_subscriptions")
    .select("plan_id, notes, status")
    .eq("box_id", box.id)
    .maybeSingle();

  add(
    "subscription notes target 25",
    !!sub?.notes?.includes("target_max_atletas=25"),
    sub?.notes ?? "null"
  );
  add("subscription active", sub?.status === "active", sub?.status ?? "null");

  const usage = await getUsageAtletas(service, box.id);
  add(
    "uso atletas activos = 25",
    usage === LOAD_TEST_TARGET_ATHLETES,
    `usage=${usage}`
  );

  if (sub?.plan_id) {
    await withTemporaryAthleteLimit(service, sub.plan_id, 25, async () => {
      const { data: plan } = await service
        .from("plans")
        .select("max_atletas, name, code, max_coaches, max_admins, features, id, price_mxn, is_active, created_at, updated_at")
        .eq("id", sub.plan_id)
        .single();

      add(
        "límite efectivo clamp = 25",
        plan?.max_atletas === 25,
        `max_atletas=${plan?.max_atletas}`
      );

      const ent = {
        boxId: box.id,
        plan: plan as BoxEntitlements["plan"],
        effectivePlanCode: "pro" as const,
        subscription: {
          id: "verify",
          box_id: box.id,
          plan_id: sub.plan_id,
          status: "active" as const,
          started_at: new Date().toISOString(),
          current_period_start: new Date().toISOString(),
          current_period_end: null,
          trial_ends_at: null,
          grace_ends_at: null,
          canceled_at: null,
          notes: LOAD_TEST_NOTES,
        },
        usage: { atletas: usage, coaches: coaches.length, admins: admins.length },
        limits: {
          max_atletas: plan?.max_atletas ?? null,
          max_coaches: plan?.max_coaches ?? null,
          max_admins: plan?.max_admins ?? null,
        },
        features: {} as BoxEntitlements["features"],
        featureDetails: [],
        promotionalDaysRemaining: null,
        canWrite: true,
        isPromotional: false,
      } satisfies BoxEntitlements;

      let rejected = false;
      try {
        assertWithinPlanLimit(ent, "atletas");
      } catch (e) {
        rejected = e instanceof EntitlementError;
      }
      add(
        "atleta #26 rechazado por límite real",
        rejected,
        rejected ? "EntitlementError" : "no rechazó"
      );
    });
  } else {
    add("subscription plan_id", false, "missing");
  }

  const athlete25 = profiles.get(athleteEmail(25).toLowerCase());
  add(
    "atleta 25 existe y activo en box",
    !!athlete25 && athlete25.box_id === box.id && athlete25.rol === "socio",
    athlete25?.id ?? "missing"
  );

  if (athlete25) {
    const { data: mem } = await service
      .from("membresias")
      .select("id, plan:planes!inner(box_id)")
      .eq("usuario_id", athlete25.id)
      .limit(1);
    const planBox = (mem?.[0]?.plan as { box_id?: string } | null)?.box_id;
    add(
      "atleta 25 membresía mismo box",
      planBox === box.id,
      planBox ?? "sin membresía"
    );

    const { data: futureClase } = await service
      .from("clases")
      .select("id")
      .eq("box_id", box.id)
      .gte("fecha", new Date().toISOString().slice(0, 10))
      .limit(1)
      .maybeSingle();

    if (futureClase) {
      const { data: existing } = await service
        .from("reservas")
        .select("id")
        .eq("clase_id", futureClase.id)
        .eq("usuario_id", athlete25.id)
        .maybeSingle();

      if (existing) {
        add("atleta 25 puede operar (reserva existente)", true, existing.id);
      } else {
        const { data: inserted, error: insErr } = await service
          .from("reservas")
          .insert({
            clase_id: futureClase.id,
            usuario_id: athlete25.id,
            estado: "confirmada",
          })
          .select("id")
          .single();

        if (insErr) {
          add("atleta 25 puede reservar", false, insErr.message);
        } else {
          await service.from("reservas").delete().eq("id", inserted.id);
          add("atleta 25 puede reservar", true, "insert+cleanup ok");
        }
      }
    } else {
      add("atleta 25 clase futura", false, "sin clases futuras");
    }
  }

  const { data: clases } = await service
    .from("clases")
    .select("id, cupo_maximo, box_id")
    .eq("box_id", box.id);
  const claseIds = (clases ?? []).map((c) => c.id);
  const claseById = new Map((clases ?? []).map((c) => [c.id, c]));

  add(
    "todas las clases en box",
    (clases ?? []).every((c) => c.box_id === box.id),
    `clases=${claseIds.length}`
  );

  let activeDupes = 0;
  let overcupo = 0;
  let crossBoxReserva = 0;

  if (claseIds.length > 0) {
    const { data: reservas } = await service
      .from("reservas")
      .select("id, clase_id, usuario_id, estado")
      .in("clase_id", claseIds);

    const activeKey = new Map<string, number>();
    const occ = new Map<string, number>();

    for (const r of reservas ?? []) {
      if (
        (ACTIVE_RESERVA_ESTADOS as readonly string[]).includes(r.estado)
      ) {
        const key = `${r.clase_id}:${r.usuario_id}`;
        activeKey.set(key, (activeKey.get(key) ?? 0) + 1);
        occ.set(r.clase_id, (occ.get(r.clase_id) ?? 0) + 1);
      }
    }

    for (const n of activeKey.values()) {
      if (n > 1) activeDupes++;
    }

    for (const [claseId, count] of occ) {
      const max = claseById.get(claseId)?.cupo_maximo ?? 0;
      if (count > max) overcupo++;
    }

    const socioSet = new Set(socios.map((s) => s.id));
    for (const r of reservas ?? []) {
      if (!socioSet.has(r.usuario_id)) {
        const { data: p } = await service
          .from("profiles")
          .select("box_id")
          .eq("id", r.usuario_id)
          .maybeSingle();
        if (p && p.box_id !== box.id) crossBoxReserva++;
      }
    }

    add(
      "0 reservas activas duplicadas",
      activeDupes === 0,
      `dupes=${activeDupes}`
    );
    add("0 clases con sobrecupo", overcupo === 0, `over=${overcupo}`);
    add(
      "0 reservas cross-box",
      crossBoxReserva === 0,
      `cross=${crossBoxReserva}`
    );
    add(
      "reservas en rango 100-250",
      (reservas?.length ?? 0) >= 100 && (reservas?.length ?? 0) <= 250,
      `count=${reservas?.length ?? 0}`
    );
  } else {
    add("clases existen", false, "0 clases");
  }

  const { data: membresias } = await service
    .from("membresias")
    .select("id, usuario_id, plan:planes!inner(box_id)")
    .in(
      "usuario_id",
      socios.map((s) => s.id)
    );

  const foreignMem = (membresias ?? []).filter(
    (m) => (m.plan as { box_id?: string } | null)?.box_id !== box.id
  );
  add(
    "membresías mismo box",
    foreignMem.length === 0,
    `foreign=${foreignMem.length} total=${membresias?.length ?? 0}`
  );

  const { data: orphanProfiles } = await service
    .from("profiles")
    .select("id")
    .eq("box_id", box.id)
    .is("user_id", null);
  add(
    "0 perfiles huérfanos sin user_id",
    (orphanProfiles?.length ?? 0) === 0,
    `count=${orphanProfiles?.length ?? 0}`
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(
    `\nResumen: ${checks.length - failed.length}/${checks.length} checks OK`
  );

  if (failed.length > 0) {
    console.error("\nFAIL — verificación load-test-25");
    process.exit(1);
  }

  console.log("\nPASS — verificación load-test-25");
}

main().catch((err) => {
  console.error("\nFAIL —", err);
  process.exit(1);
});
