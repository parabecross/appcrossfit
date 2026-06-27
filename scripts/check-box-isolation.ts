/**
 * Verifica aislamiento multi-tenant por box_id vía RLS real (cliente anon + login).
 *
 *   npm run check-isolation
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !anonKey || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const TEST_PASSWORD = "TestIsolation2024!";
const EMAILS = {
  adminA: "test-isolation-admin-a@athron.test",
  socioA: "test-isolation-socio-a@athron.test",
  adminB: "test-isolation-admin-b@athron.test",
  socioB: "test-isolation-socio-b@athron.test",
} as const;

const BOX_SLUGS = { a: "test-box-a", b: "test-box-b" } as const;

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Check = { label: string; pass: boolean; detail: string };

type BoxFixture = {
  boxId: string;
  adminProfileId: string;
  socioProfileId: string;
  planId: string;
  claseId: string;
  reservaId: string;
  prId: string;
  membresiaId: string;
};

const checks: Check[] = [];
const createdClaseIds: string[] = [];
const createdPlanIds: string[] = [];

function addCheck(label: string, pass: boolean, detail: string) {
  checks.push({ label, pass, detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`);
}

function futureDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function listAuthUsersByEmail() {
  const map = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email) map.set(u.email.toLowerCase(), u.id);
    }
    if (data.users.length < 200) break;
    page++;
  }
  return map;
}

async function ensureBox(slug: string, name: string): Promise<string> {
  const { data: existing } = await service
    .from("boxes")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await service
    .from("boxes")
    .insert({
      name,
      slug,
      status: "active",
      plan: "free",
      timezone: "America/Mexico_City",
    })
    .select("id")
    .single();
  if (error) throw new Error(`Box ${slug}: ${error.message}`);
  return data.id;
}

async function ensureUser(
  email: string,
  nombre: string,
  boxId: string,
  rol: "admin" | "socio"
): Promise<string> {
  const authByEmail = await listAuthUsersByEmail();
  let authId = authByEmail.get(email.toLowerCase());

  if (!authId) {
    const { data, error } = await service.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        nombre_completo: nombre,
        rol: "socio",
        box_id: boxId,
      },
    });
    if (error) throw new Error(`User ${email}: ${error.message}`);
    authId = data.user!.id;
  }

  await service
    .from("profiles")
    .update({
      rol,
      box_id: boxId,
      estado_cuenta: "activo",
      nombre_completo: nombre,
    })
    .eq("user_id", authId);

  const { data: profile, error: profileErr } = await service
    .from("profiles")
    .select("id")
    .eq("user_id", authId)
    .single();
  if (profileErr || !profile) throw new Error(`Profile not found: ${email}`);
  return profile.id;
}

async function ensurePlan(boxId: string, nombre: string): Promise<string> {
  const { data: existing } = await service
    .from("planes")
    .select("id")
    .eq("box_id", boxId)
    .eq("nombre", nombre)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await service
    .from("planes")
    .insert({
      nombre,
      tipo: "mensual_fijo",
      duracion_dias: 30,
      precio: 999,
      activo: true,
      box_id: boxId,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Plan ${nombre}: ${error.message}`);
  createdPlanIds.push(data.id);
  return data.id;
}

async function ensureClase(
  boxId: string,
  coachProfileId: string,
  nombre: string
): Promise<string> {
  const seedFecha = futureDate(60);
  const { data: existing } = await service
    .from("clases")
    .select("id")
    .eq("nombre", nombre)
    .eq("coach_id", coachProfileId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await service
    .from("clases")
    .insert({
      nombre,
      fecha: seedFecha,
      hora_inicio: "10:00",
      hora_fin: "11:00",
      cupo_maximo: 12,
      coach_id: coachProfileId,
      estado: "programada",
    })
    .select("id")
    .single();
  if (error) throw new Error(`Clase ${nombre}: ${error.message}`);
  createdClaseIds.push(data.id);
  return data.id;
}

async function ensureReserva(
  claseId: string,
  socioProfileId: string
): Promise<string> {
  const { data: existing } = await service
    .from("reservas")
    .select("id")
    .eq("clase_id", claseId)
    .eq("usuario_id", socioProfileId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: rpcId, error: rpcErr } = await service.rpc(
    "admin_insert_reserva",
    {
      p_clase_id: claseId,
      p_usuario_id: socioProfileId,
      p_estado: "confirmada",
    }
  );

  if (!rpcErr && rpcId) return rpcId as string;

  const { data, error } = await service
    .from("reservas")
    .insert({
      clase_id: claseId,
      usuario_id: socioProfileId,
      estado: "confirmada",
    })
    .select("id")
    .single();
  if (error) throw new Error(`Reserva: ${error.message}`);
  return data.id;
}

async function ensureMembresia(
  socioProfileId: string,
  planId: string
): Promise<string> {
  const { data: existing } = await service
    .from("membresias")
    .select("id")
    .eq("usuario_id", socioProfileId)
    .eq("plan_id", planId)
    .maybeSingle();
  if (existing) return existing.id;

  const inicio = futureDate(0);
  const fin = futureDate(30);
  const { data, error } = await service
    .from("membresias")
    .insert({
      usuario_id: socioProfileId,
      plan_id: planId,
      fecha_inicio: inicio,
      fecha_fin: fin,
      estado: "vigente",
      metodo_asignacion: "automatico",
    })
    .select("id")
    .single();
  if (error) throw new Error(`Membresia: ${error.message}`);
  return data.id;
}

async function ensurePr(socioProfileId: string): Promise<string> {
  const { data: existing } = await service
    .from("atleta_pr_marcas")
    .select("id")
    .eq("usuario_id", socioProfileId)
    .eq("ejercicio", "isolation-back-squat")
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await service
    .from("atleta_pr_marcas")
    .insert({
      usuario_id: socioProfileId,
      ejercicio: "isolation-back-squat",
      record_tipo: "pr",
      valor: 100,
      unidad: "lbs",
      fecha: futureDate(0),
    })
    .select("id")
    .single();
  if (error) throw new Error(`PR: ${error.message}`);
  return data.id;
}

async function signInClient(email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (error) throw new Error(`Sign in ${email}: ${error.message}`);
  return client;
}

async function runNegativeSuite(
  adminEmail: string,
  other: BoxFixture,
  prefix: string
) {
  const client = await signInClient(adminEmail);

  const { data: prof } = await client
    .from("profiles")
    .select("id")
    .eq("id", other.socioProfileId)
    .maybeSingle();
  addCheck(
    `${prefix} profiles SELECT socio other box`,
    !prof,
    prof ? `got profile ${prof.id}` : "empty"
  );

  const { data: mems } = await client
    .from("membresias")
    .select("id")
    .eq("usuario_id", other.socioProfileId);
  addCheck(
    `${prefix} membresias SELECT socio other box`,
    (mems ?? []).length === 0,
    `rows=${mems?.length ?? 0}`
  );

  const { data: clases } = await client
    .from("clases")
    .select("id")
    .eq("coach_id", other.adminProfileId);
  addCheck(
    `${prefix} clases SELECT coach other box`,
    (clases ?? []).length === 0,
    `rows=${clases?.length ?? 0}`
  );

  const { data: reservas } = await client
    .from("reservas")
    .select("id")
    .eq("usuario_id", other.socioProfileId);
  addCheck(
    `${prefix} reservas SELECT socio other box`,
    (reservas ?? []).length === 0,
    `rows=${reservas?.length ?? 0}`
  );

  const { data: planes } = await client
    .from("planes")
    .select("id")
    .eq("box_id", other.boxId);
  addCheck(
    `${prefix} planes SELECT other box`,
    (planes ?? []).length === 0,
    `rows=${planes?.length ?? 0}`
  );

  const { data: prs } = await client
    .from("atleta_pr_marcas")
    .select("id")
    .eq("usuario_id", other.socioProfileId);
  addCheck(
    `${prefix} atleta_pr_marcas SELECT socio other box`,
    (prs ?? []).length === 0,
    `rows=${prs?.length ?? 0}`
  );

  const { data: profUpd, error: profUpdErr } = await client
    .from("profiles")
    .update({ estado_cuenta: "activo" })
    .eq("id", other.socioProfileId)
    .select("id");
  addCheck(
    `${prefix} profiles UPDATE socio other box`,
    !profUpdErr && (profUpd ?? []).length === 0,
    profUpdErr?.message ?? `rows=${profUpd?.length ?? 0}`
  );

  const { data: memUpd, error: memUpdErr } = await client
    .from("membresias")
    .update({ estado: "cancelada" })
    .eq("usuario_id", other.socioProfileId)
    .select("id");
  addCheck(
    `${prefix} membresias UPDATE socio other box`,
    !memUpdErr && (memUpd ?? []).length === 0,
    memUpdErr?.message ?? `rows=${memUpd?.length ?? 0}`
  );

  await client.auth.signOut();
}

async function runPositiveSuite(
  adminEmail: string,
  own: BoxFixture,
  prefix: string
) {
  const client = await signInClient(adminEmail);

  const { data: prof } = await client
    .from("profiles")
    .select("id")
    .eq("id", own.socioProfileId)
    .maybeSingle();
  addCheck(
    `${prefix} profiles SELECT own socio`,
    !!prof,
    prof ? "ok" : "empty"
  );

  const { data: mems } = await client
    .from("membresias")
    .select("id")
    .eq("usuario_id", own.socioProfileId);
  addCheck(
    `${prefix} membresias SELECT own socio`,
    (mems ?? []).length > 0,
    `rows=${mems?.length ?? 0}`
  );

  const { data: clases } = await client
    .from("clases")
    .select("id")
    .eq("coach_id", own.adminProfileId);
  addCheck(
    `${prefix} clases SELECT own coach`,
    (clases ?? []).length > 0,
    `rows=${clases?.length ?? 0}`
  );

  const { data: reservas } = await client
    .from("reservas")
    .select("id")
    .eq("usuario_id", own.socioProfileId);
  addCheck(
    `${prefix} reservas SELECT own socio`,
    (reservas ?? []).length > 0,
    `rows=${reservas?.length ?? 0}`
  );

  const { data: planes } = await client
    .from("planes")
    .select("id")
    .eq("box_id", own.boxId);
  addCheck(
    `${prefix} planes SELECT own box`,
    (planes ?? []).length > 0,
    `rows=${planes?.length ?? 0}`
  );

  const { data: prs } = await client
    .from("atleta_pr_marcas")
    .select("id")
    .eq("usuario_id", own.socioProfileId);
  addCheck(
    `${prefix} atleta_pr_marcas SELECT own socio`,
    (prs ?? []).length > 0,
    `rows=${prs?.length ?? 0}`
  );

  const { data: profUpd, error: profUpdErr } = await client
    .from("profiles")
    .update({ bio: "isolation-test-ok" })
    .eq("id", own.socioProfileId)
    .select("id");
  addCheck(
    `${prefix} profiles UPDATE own socio`,
    !profUpdErr && (profUpd ?? []).length === 1,
    profUpdErr?.message ?? `rows=${profUpd?.length ?? 0}`
  );

  const { data: memUpd, error: memUpdErr } = await client
    .from("membresias")
    .update({ notas: "isolation-test-ok" })
    .eq("id", own.membresiaId)
    .select("id");
  addCheck(
    `${prefix} membresias UPDATE own socio`,
    !memUpdErr && (memUpd ?? []).length === 1,
    memUpdErr?.message ?? `rows=${memUpd?.length ?? 0}`
  );

  await client.auth.signOut();
}

async function setupBox(
  slug: string,
  name: string,
  adminEmail: string,
  socioEmail: string,
  adminNombre: string,
  socioNombre: string
): Promise<BoxFixture> {
  const boxId = await ensureBox(slug, name);
  const adminProfileId = await ensureUser(
    adminEmail,
    adminNombre,
    boxId,
    "admin"
  );
  const socioProfileId = await ensureUser(
    socioEmail,
    socioNombre,
    boxId,
    "socio"
  );
  const planId = await ensurePlan(boxId, `Test Plan ${slug}`);
  const claseId = await ensureClase(
    boxId,
    adminProfileId,
    `Test Clase ${slug}`
  );
  const reservaId = await ensureReserva(claseId, socioProfileId);
  const membresiaId = await ensureMembresia(socioProfileId, planId);
  const prId = await ensurePr(socioProfileId);

  return {
    boxId,
    adminProfileId,
    socioProfileId,
    planId,
    claseId,
    reservaId,
    prId,
    membresiaId,
  };
}

async function cleanup() {
  console.log("\n🧹 Cleanup test users and data…");
  const emails = Object.values(EMAILS);
  const authByEmail = await listAuthUsersByEmail();
  const authIds = emails
    .map((e) => authByEmail.get(e.toLowerCase()))
    .filter(Boolean) as string[];

  const { data: profiles } = await service
    .from("profiles")
    .select("id")
    .in(
      "user_id",
      authIds.length ? authIds : ["00000000-0000-0000-0000-000000000000"]
    );

  const profileIds = (profiles ?? []).map((p) => p.id);

  if (profileIds.length > 0) {
    await service
      .from("atleta_pr_marcas")
      .delete()
      .in("usuario_id", profileIds);
    await service.from("membresias").delete().in("usuario_id", profileIds);
    await service.from("reservas").delete().in("usuario_id", profileIds);
    await service.from("clases").delete().in("coach_id", profileIds);
  }

  for (const claseId of createdClaseIds) {
    await service.from("reservas").delete().eq("clase_id", claseId);
    await service.from("clases").delete().eq("id", claseId);
  }

  const boxA = await service
    .from("boxes")
    .select("id")
    .eq("slug", BOX_SLUGS.a)
    .maybeSingle();
  const boxB = await service
    .from("boxes")
    .select("id")
    .eq("slug", BOX_SLUGS.b)
    .maybeSingle();
  const boxIds = [boxA.data?.id, boxB.data?.id].filter(Boolean) as string[];

  if (boxIds.length > 0) {
    await service.from("planes").delete().in("box_id", boxIds);
  }

  for (const authId of authIds) {
    const { error } = await service.auth.admin.deleteUser(authId);
    if (error) console.warn(`  ⚠ delete ${authId}: ${error.message}`);
  }

  console.log("✓ Cleanup done (test boxes kept for reuse)\n");
}

async function main() {
  console.log("🔒 Box isolation check\n");

  let boxA: BoxFixture | null = null;
  let boxB: BoxFixture | null = null;

  try {
    boxA = await setupBox(
      BOX_SLUGS.a,
      "Test Box A",
      EMAILS.adminA,
      EMAILS.socioA,
      "Admin A",
      "Socio A"
    );
    boxB = await setupBox(
      BOX_SLUGS.b,
      "Test Box B",
      EMAILS.adminB,
      EMAILS.socioB,
      "Admin B",
      "Socio B"
    );

    console.log("\n--- Negative: admin_a → Box B ---\n");
    await runNegativeSuite(EMAILS.adminA, boxB, "admin_a→B");

    console.log("\n--- Negative: admin_b → Box A ---\n");
    await runNegativeSuite(EMAILS.adminB, boxA, "admin_b→A");

    console.log("\n--- Positive: admin_a → Box A ---\n");
    await runPositiveSuite(EMAILS.adminA, boxA, "admin_a→A");
  } finally {
    await cleanup();
  }

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  const failed = checks.filter((c) => !c.pass);

  console.log("══════════════════════════════════════════");
  console.log(`Result: ${passed}/${total} checks passed`);
  if (failed.length > 0) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  • ${f.label}: ${f.detail}`);
  }
  console.log("══════════════════════════════════════════\n");

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  cleanup().finally(() => process.exit(1));
});
