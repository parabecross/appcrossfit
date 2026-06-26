/**
 * Limpia datos de demo de Parabellum Cross.
 * Deja: admin, 2 coaches, 4 socios, clases hoy/mañana en la mañana.
 *
 *   npm run cleanup-parabellum
 */

import { createClient } from "@supabase/supabase-js";
import { getSampleWorkout } from "../src/lib/clases/sample-workouts";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BOX_SLUG = "parabellum-cross";
const TIMEZONE = "America/Mexico_City";

const KEEP_EMAILS = new Set([
  "admin@parabellum.cross",
  "coach.maria@parabellum.cross",
  "coach.diego@parabellum.cross",
  "lucia.herrera@email.com",
  "jorge.martinez@email.com",
  "sofia.lopez@email.com",
  "miguel.ramos@email.com",
]);

function todayInTimezone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "01";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().split("T")[0];
}

async function listAllAuthUsers() {
  const users: { id: string; email?: string }[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...data.users.map((u) => ({ id: u.id, email: u.email })));
    if (data.users.length < perPage) break;
    page++;
  }

  return users;
}

async function main() {
  console.log("🧹 Limpiando Parabellum Cross...\n");

  const { data: box, error: boxErr } = await supabase
    .from("boxes")
    .select("id, name")
    .eq("slug", BOX_SLUG)
    .single();

  if (boxErr || !box) {
    console.error(`No se encontró el box "${BOX_SLUG}".`);
    process.exit(1);
  }

  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, user_id, nombre_completo, rol, is_super_admin")
    .eq("box_id", box.id);

  if (profErr) throw profErr;

  const authUsers = await listAllAuthUsers();
  const emailByUserId = new Map(
    authUsers.map((u) => [u.id, u.email?.toLowerCase() ?? ""])
  );

  const boxProfileIds = (profiles ?? []).map((p) => p.id);
  const staffIds = (profiles ?? [])
    .filter((p) => ["admin", "coach", "box_admin"].includes(p.rol))
    .map((p) => p.id);

  // ─── Reservas del box ─────────────────────────────────────────────────────
  const { data: clasesBox } = await supabase
    .from("clases")
    .select("id")
    .in("coach_id", staffIds.length ? staffIds : ["00000000-0000-0000-0000-000000000000"]);

  const claseIds = (clasesBox ?? []).map((c) => c.id);

  if (claseIds.length > 0) {
    const { error } = await supabase.from("reservas").delete().in("clase_id", claseIds);
    if (error) throw error;
    console.log(`✓ ${claseIds.length} clases sin reservas`);
  }

  const { error: resSocioErr } = await supabase
    .from("reservas")
    .delete()
    .in("usuario_id", boxProfileIds);
  if (resSocioErr) throw resSocioErr;
  console.log("✓ Reservas del box eliminadas");

  // ─── Clases del box ───────────────────────────────────────────────────────
  if (staffIds.length > 0) {
    const { error } = await supabase.from("clases").delete().in("coach_id", staffIds);
    if (error) throw error;
  }
  console.log("✓ Clases anteriores eliminadas");

  // ─── Usuarios a eliminar ──────────────────────────────────────────────────
  const toDelete = (profiles ?? []).filter((p) => {
    if (p.is_super_admin) return false;
    const email = emailByUserId.get(p.user_id) ?? "";
    return !KEEP_EMAILS.has(email);
  });

  for (const p of toDelete) {
    const email = emailByUserId.get(p.user_id) ?? p.nombre_completo;
    const { error } = await supabase.auth.admin.deleteUser(p.user_id);
    if (error) {
      console.warn(`  ⚠ No se pudo borrar ${email}: ${error.message}`);
    } else {
      console.log(`  − Eliminado: ${email}`);
    }
  }

  // ─── Perfiles que quedan ──────────────────────────────────────────────────
  const { data: keptProfiles } = await supabase
    .from("profiles")
    .select("id, user_id, nombre_completo, rol")
    .eq("box_id", box.id);

  const keptSocios = (keptProfiles ?? []).filter((p) => p.rol === "socio");
  const keptCoaches = (keptProfiles ?? []).filter((p) => p.rol === "coach");

  // ─── Membresías limpias (1 vigente por socio) ─────────────────────────────
  if (keptSocios.length > 0) {
    await supabase
      .from("membresias")
      .delete()
      .in(
        "usuario_id",
        keptSocios.map((s) => s.id)
      );

    const { data: plan } = await supabase
      .from("planes")
      .select("id")
      .eq("nombre", "Mensualidad Normal")
      .maybeSingle();

    if (plan) {
      const hoy = todayInTimezone(TIMEZONE);
      const fin = addDays(hoy, 30);
      for (const s of keptSocios) {
        await supabase.from("membresias").insert({
          usuario_id: s.id,
          plan_id: plan.id,
          fecha_inicio: hoy,
          fecha_fin: fin,
          estado: "vigente",
          metodo_asignacion: "automatico",
        });
      }
      console.log(`✓ Membresías renovadas para ${keptSocios.length} socios`);
    }
  }

  // ─── Progreso atleta (limpiar de socios que quedan) ───────────────────────
  if (keptSocios.length > 0) {
    const socioIds = keptSocios.map((s) => s.id);
    await supabase.from("atleta_pr_marcas").delete().in("usuario_id", socioIds);
    await supabase.from("atleta_skills").delete().in("usuario_id", socioIds);
    console.log("✓ Progreso de atleta limpiado");
  }

  // ─── Socios: cuenta activa ────────────────────────────────────────────────
  for (const s of keptSocios) {
    await supabase
      .from("profiles")
      .update({ estado_cuenta: "activo" })
      .eq("id", s.id);
  }

  // ─── Clases hoy y mañana (mañana temprano) ────────────────────────────────
  const hoy = todayInTimezone(TIMEZONE);
  const manana = addDays(hoy, 1);
  const coachIds = keptCoaches.map((c) => c.id);

  const morningSlots = [
    { nombre: "WOD Matutino", start: "06:00", end: "07:00" },
    { nombre: "Hyrox", start: "07:00", end: "08:00" },
  ];

  let clasesCreadas = 0;
  for (const fecha of [hoy, manana]) {
    for (let i = 0; i < morningSlots.length; i++) {
      const slot = morningSlots[i];
      const { error } = await supabase.from("clases").insert({
        nombre: slot.nombre,
        fecha,
        hora_inicio: slot.start,
        hora_fin: slot.end,
        cupo_maximo: 12,
        coach_id: coachIds[i % coachIds.length],
        estado: "programada",
        entrenamiento: getSampleWorkout(slot.nombre),
      });
      if (error) throw error;
      clasesCreadas++;
    }
  }
  console.log(`✓ ${clasesCreadas} clases creadas (${hoy} y ${manana}, 06:00–08:00)`);

  console.log("\n══════════════════════════════════════════");
  console.log("  LIMPIEZA COMPLETADA");
  console.log("══════════════════════════════════════════");
  console.log(`\n  Box: ${box.name}`);
  console.log(`  Admin:     admin@parabellum.cross`);
  console.log(`  Coaches:   coach.maria@, coach.diego@`);
  console.log(`  Socios:    lucia, jorge, sofia, miguel (@email.com)`);
  console.log(`  Password:  Parabellum2024!`);
  console.log("\n══════════════════════════════════════════\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
