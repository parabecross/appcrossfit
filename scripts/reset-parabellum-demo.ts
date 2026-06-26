/**
 * Reset demo Parabellum Cross:
 * - Elimina socios y coaches actuales (conserva admin)
 * - 2 coaches (2 clases cada uno)
 * - 10 atletas con PRs, skills y objetivos
 * - 5 clases pasadas (mañana/tarde) + 5 futuras
 * - Reservas pasadas (asistió/no asistió) y futuras (confirmada)
 *
 *   npm run reset-parabellum
 */

import { createClient } from "@supabase/supabase-js";
import { getSampleWorkout } from "../src/lib/clases/sample-workouts";
import { PR_EXERCISES, SKILL_KEYS } from "../src/lib/progreso/constants";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BOX_SLUG = "parabellum-cross";
const TIMEZONE = "America/Mexico_City";
const PASSWORD = "Parabellum2024!";
const ADMIN_EMAIL = "admin@parabellum.cross";

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
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    users.push(...data.users.map((u) => ({ id: u.id, email: u.email })));
    if (data.users.length < 200) break;
    page++;
  }
  return users;
}

async function createUser(
  boxId: string,
  email: string,
  nombre: string,
  rol: "socio" | "coach",
  extra?: { telefono?: string; bio?: string; estado_cuenta?: string }
) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      nombre_completo: nombre,
      telefono: extra?.telefono,
      bio: extra?.bio,
      rol,
      box_id: boxId,
    },
  });
  if (error) throw new Error(`User ${email}: ${error.message}`);

  const updates: Record<string, string> = { rol };
  if (extra?.estado_cuenta) updates.estado_cuenta = extra.estado_cuenta;
  if (extra?.telefono) updates.telefono = extra.telefono;
  if (extra?.bio) updates.bio = extra.bio;

  await supabase
    .from("profiles")
    .update(updates)
    .eq("user_id", data.user!.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", data.user!.id)
    .single();

  return profile!.id;
}

async function insertReserva(
  claseId: string,
  usuarioId: string,
  estado: "confirmada" | "asistio" | "no_asistio"
) {
  const { error } = await supabase.from("reservas").insert({
    clase_id: claseId,
    usuario_id: usuarioId,
    estado,
  });
  if (error) throw new Error(`Reserva: ${error.message}`);
}

async function main() {
  console.log("🥊 Reset demo Parabellum Cross...\n");

  const { data: box, error: boxErr } = await supabase
    .from("boxes")
    .select("id, name")
    .eq("slug", BOX_SLUG)
    .single();

  if (boxErr || !box) {
    console.error(`No se encontró el box "${BOX_SLUG}".`);
    process.exit(1);
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, user_id, nombre_completo, rol, is_super_admin")
    .eq("box_id", box.id);

  const authUsers = await listAllAuthUsers();
  const emailByUserId = new Map(
    authUsers.map((u) => [u.id, u.email?.toLowerCase() ?? ""])
  );

  const boxProfileIds = (profiles ?? []).map((p) => p.id);
  const staffIds = (profiles ?? [])
    .filter((p) => ["admin", "coach", "box_admin"].includes(p.rol))
    .map((p) => p.id);

  // ─── Limpiar reservas y clases ────────────────────────────────────────────
  if (boxProfileIds.length > 0) {
    await supabase.from("reservas").delete().in("usuario_id", boxProfileIds);
  }

  if (staffIds.length > 0) {
    const { data: clasesBox } = await supabase
      .from("clases")
      .select("id")
      .in("coach_id", staffIds);
    const claseIds = (clasesBox ?? []).map((c) => c.id);
    if (claseIds.length > 0) {
      await supabase.from("reservas").delete().in("clase_id", claseIds);
      await supabase.from("clases").delete().in("id", claseIds);
    }
  }
  console.log("✓ Reservas y clases anteriores eliminadas");

  // ─── Eliminar socios y coaches (conservar admin) ──────────────────────────
  const toDelete = (profiles ?? []).filter((p) => {
    if (p.is_super_admin) return false;
    const email = emailByUserId.get(p.user_id) ?? "";
    if (email === ADMIN_EMAIL) return false;
    return p.rol === "socio" || p.rol === "coach";
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

  // ─── Plan ─────────────────────────────────────────────────────────────────
  let { data: plan } = await supabase
    .from("planes")
    .select("id")
    .eq("nombre", "Mensualidad Normal")
    .maybeSingle();

  if (!plan) {
    const { data: created, error } = await supabase
      .from("planes")
      .insert({
        nombre: "Mensualidad Normal",
        tipo: "mensual_fijo",
        duracion_dias: 30,
        precio: 1200,
        activo: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    plan = created;
  }

  const hoy = todayInTimezone(TIMEZONE);

  // ─── 2 coaches (2 clases cada uno) ────────────────────────────────────────
  const coachMaria = await createUser(
    box.id,
    "coach.maria@parabellum.cross",
    "María Vega",
    "coach",
    {
      telefono: "+52 55 2345 6789",
      bio: "CrossFit L2 · Halterofilia",
      estado_cuenta: "activo",
    }
  );
  const coachDiego = await createUser(
    box.id,
    "coach.diego@parabellum.cross",
    "Diego Ruiz",
    "coach",
    {
      telefono: "+52 55 3456 7890",
      bio: "Hyrox & conditioning",
      estado_cuenta: "activo",
    }
  );
  console.log("✓ 2 coaches creados");

  // ─── 10 atletas ───────────────────────────────────────────────────────────
  const athleteDefs = [
    { email: "lucia.herrera@email.com", nombre: "Lucía Herrera", memDays: 22 },
    { email: "jorge.martinez@email.com", nombre: "Jorge Martínez", memDays: 18 },
    { email: "sofia.lopez@email.com", nombre: "Sofía López", memDays: 4 },
    { email: "miguel.ramos@email.com", nombre: "Miguel Ramos", memDays: 28 },
    { email: "elena.castro@email.com", nombre: "Elena Castro", memDays: 15 },
    { email: "pablo.silva@email.com", nombre: "Pablo Silva", memDays: -3 },
    { email: "carla.mendez@email.com", nombre: "Carla Méndez", memDays: 25 },
    { email: "andres.vargas@email.com", nombre: "Andrés Vargas", memDays: 12 },
    { email: "valeria.nunez@email.com", nombre: "Valeria Núñez", memDays: 20 },
    { email: "ricardo.pena@email.com", nombre: "Ricardo Peña", memDays: 8 },
  ];

  const socioIds: string[] = [];
  for (const a of athleteDefs) {
    const id = await createUser(box.id, a.email, a.nombre, "socio", {
      telefono: "+52 55 6000 " + String(1000 + socioIds.length),
      bio: "Atleta Parabellum Cross",
      estado_cuenta: "activo",
    });
    socioIds.push(id);

    await supabase.from("membresias").insert({
      usuario_id: id,
      plan_id: plan!.id,
      fecha_inicio: addDays(hoy, -30),
      fecha_fin: addDays(hoy, a.memDays),
      estado: a.memDays < 0 ? "vencida" : "vigente",
      metodo_asignacion: "automatico",
    });
  }
  console.log("✓ 10 atletas con membresías");

  // ─── Clases: 5 pasadas + 5 futuras (cada coach solo 2 clases) ─────────────
  const pastClasses = [
    { offset: -8, nombre: "WOD Matutino", start: "06:00", end: "07:00", coach: coachMaria },
    { offset: -6, nombre: "Hyrox", start: "07:00", end: "08:00", coach: null },
    { offset: -5, nombre: "Halterofilia", start: "17:00", end: "18:00", coach: coachDiego },
    { offset: -3, nombre: "Gimnasia", start: "09:00", end: "10:00", coach: null },
    { offset: -1, nombre: "WOD Tarde", start: "18:30", end: "19:30", coach: null },
  ];

  const futureClasses = [
    { offset: 1, nombre: "WOD Matutino", start: "06:00", end: "07:00", coach: null },
    { offset: 1, nombre: "Halterofilia", start: "17:00", end: "18:00", coach: coachMaria },
    { offset: 2, nombre: "Hyrox", start: "07:00", end: "08:00", coach: null },
    { offset: 3, nombre: "Gimnasia", start: "18:30", end: "19:30", coach: coachDiego },
    { offset: 5, nombre: "WOD Tarde", start: "09:00", end: "10:00", coach: null },
  ];

  const claseRecords: {
    id: string;
    past: boolean;
    targetFecha: string;
  }[] = [];

  for (const c of [...pastClasses, ...futureClasses]) {
    const targetFecha = addDays(hoy, c.offset);
    const seedFecha = c.offset < 0 ? addDays(hoy, 30 + Math.abs(c.offset)) : targetFecha;
    const { data: clase, error } = await supabase
      .from("clases")
      .insert({
        nombre: c.nombre,
        fecha: seedFecha,
        hora_inicio: c.start,
        hora_fin: c.end,
        cupo_maximo: 12,
        coach_id: c.coach,
        estado: "programada",
        entrenamiento: getSampleWorkout(c.nombre),
      })
      .select("id")
      .single();
    if (error) throw error;
    claseRecords.push({
      id: clase.id,
      past: c.offset < 0,
      targetFecha,
    });
  }
  console.log(`✓ ${claseRecords.length} clases (5 pasadas + 5 futuras)`);

  // ─── Reservas (clases pasadas se crean en fecha futura, luego se mueven) ──
  let reservaCount = 0;
  const pastClases = claseRecords.filter((c) => c.past);
  const futureClases = claseRecords.filter((c) => !c.past);

  for (let i = 0; i < pastClases.length; i++) {
    const { id: claseId } = pastClases[i];
    const attendees = socioIds.slice(i % 3, (i % 3) + 6);
    const padded =
      attendees.length < 6
        ? [...attendees, ...socioIds.slice(0, 6 - attendees.length)]
        : attendees;

    for (let j = 0; j < padded.length; j++) {
      await insertReserva(claseId, padded[j], "confirmada");
      reservaCount++;
    }
  }

  for (let i = 0; i < futureClases.length; i++) {
    const claseId = futureClases[i].id;
    const bookers = socioIds.slice(i, i + 7);
    for (const uid of bookers) {
      await insertReserva(claseId, uid, "confirmada");
      reservaCount++;
    }
  }

  for (const c of pastClases) {
    const { error } = await supabase
      .from("clases")
      .update({ fecha: c.targetFecha })
      .eq("id", c.id);
    if (error) throw error;
  }

  const { data: pastReservas } = await supabase
    .from("reservas")
    .select("id, usuario_id, clase_id")
    .in(
      "clase_id",
      pastClases.map((c) => c.id)
    );

  let idx = 0;
  for (const r of pastReservas ?? []) {
    const estado = idx % 5 === 0 ? "no_asistio" : "asistio";
    await supabase.from("reservas").update({ estado }).eq("id", r.id);
    idx++;
  }

  console.log(`✓ ${reservaCount} reservas (pasadas y futuras)`);

  // ─── Progreso: PRs, skills, objetivos ─────────────────────────────────────
  const prPool = PR_EXERCISES.slice(0, 8);
  const skillPool = SKILL_KEYS.slice(0, 6);

  for (let i = 0; i < socioIds.length; i++) {
    const uid = socioIds[i];

    const prs = [
      {
        ejercicio: prPool[i % prPool.length].key,
        valor: 135 + i * 15,
        unidad: prPool[i % prPool.length].unit,
        fecha: addDays(hoy, -14 - i),
      },
      {
        ejercicio: prPool[(i + 2) % prPool.length].key,
        valor: 95 + i * 10,
        unidad: prPool[(i + 2) % prPool.length].unit,
        fecha: addDays(hoy, -7 - i),
      },
    ];

    if (i < 6) {
      prs.push({
        ejercicio: prPool[(i + 4) % prPool.length].key,
        valor: 185 + i * 5,
        unidad: "lbs",
        fecha: addDays(hoy, -2),
      });
    }

    await supabase.from("atleta_pr_marcas").insert(
      prs.map((p) => ({
        usuario_id: uid,
        ejercicio: p.ejercicio,
        record_tipo: "pr",
        valor: p.valor,
        unidad: p.unidad,
        fecha: p.fecha,
      }))
    );

    const skillKey = skillPool[i % skillPool.length];
    const skillEstado = i % 3 === 0 ? "dominado" : i % 2 === 0 ? "logrado" : "en_proceso";
    await supabase.from("atleta_skills").insert({
      usuario_id: uid,
      skill: skillKey,
      estado: skillEstado,
    });

    if (i % 4 !== 3) {
      await supabase.from("atleta_objetivos").insert({
        usuario_id: uid,
        nombre:
          i % 2 === 0
            ? "Primer muscle-up"
            : `Back squat ${200 + i * 5} lb`,
        estado: i % 5 === 0 ? "completado" : "en_proceso",
        progreso_pct: i % 5 === 0 ? 100 : 40 + i * 5,
        fecha_objetivo: addDays(hoy, 30 + i * 7),
      });
    }
  }
  console.log("✓ PRs, skills y objetivos por atleta");

  console.log("\n══════════════════════════════════════════");
  console.log("  RESET DEMO COMPLETADO");
  console.log("══════════════════════════════════════════");
  console.log(`\n  Box: ${box.name}`);
  console.log(`  Admin:    ${ADMIN_EMAIL}`);
  console.log(`  Coaches:  coach.maria@, coach.diego@ (2 clases c/u)`);
  console.log(`  Atletas:  10 (lucia.herrera@ … ricardo.pena@email.com)`);
  console.log(`  Clases:   5 pasadas + 5 futuras`);
  console.log(`  Password: ${PASSWORD}`);
  console.log("\n══════════════════════════════════════════\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
