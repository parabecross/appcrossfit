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

async function markPastClassAttendance(claseId: string, usuarioIds: string[]) {
  for (let j = 0; j < usuarioIds.length; j++) {
    const estado = j === 0 ? "no_asistio" : "asistio";
    const { data: row, error: findErr } = await supabase
      .from("reservas")
      .select("id")
      .eq("clase_id", claseId)
      .eq("usuario_id", usuarioIds[j])
      .single();
    if (findErr || !row) {
      throw new Error(`Reserva no encontrada para marcar asistencia: ${findErr?.message}`);
    }
    const { error } = await supabase
      .from("reservas")
      .update({ estado })
      .eq("id", row.id);
    if (error) throw new Error(`Marcar asistencia: ${error.message}`);
  }
}

async function deleteAllBoxClases(
  staffIds: string[],
  boxProfileIds: string[]
) {
  const claseIdSet = new Set<string>();

  if (staffIds.length > 0) {
    const { data } = await supabase
      .from("clases")
      .select("id")
      .in("coach_id", staffIds);
    for (const c of data ?? []) claseIdSet.add(c.id);
  }

  if (boxProfileIds.length > 0) {
    const { data: reservas } = await supabase
      .from("reservas")
      .select("clase_id")
      .in("usuario_id", boxProfileIds);
    for (const r of reservas ?? []) claseIdSet.add(r.clase_id);
  }

  const { data: orphans } = await supabase
    .from("clases")
    .select("id")
    .is("coach_id", null);
  for (const c of orphans ?? []) claseIdSet.add(c.id);

  const claseIds = Array.from(claseIdSet);
  if (claseIds.length === 0) return 0;

  await supabase.from("reservas").delete().in("clase_id", claseIds);
  if (boxProfileIds.length > 0) {
    await supabase.from("reservas").delete().in("usuario_id", boxProfileIds);
  }
  const { error } = await supabase.from("clases").delete().in("id", claseIds);
  if (error) throw error;
  return claseIds.length;
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
  const deletedClases = await deleteAllBoxClases(staffIds, boxProfileIds);
  console.log(`✓ ${deletedClases} clases y reservas anteriores eliminadas`);

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

  // ─── Clases: 5 pasadas + 5 futuras (todas con coach asignado) ─────────────
  // Nota: getClasesByDateRange solo muestra clases con coach_id del box.
  const pastClasses = [
    { offset: -5, nombre: "WOD Matutino", start: "06:00", end: "07:00", coach: coachMaria },
    { offset: -4, nombre: "Halterofilia", start: "17:00", end: "18:00", coach: coachDiego },
    { offset: -3, nombre: "Hyrox", start: "07:00", end: "08:00", coach: coachMaria },
    { offset: -2, nombre: "Gimnasia", start: "18:30", end: "19:30", coach: coachDiego },
    { offset: -1, nombre: "WOD Tarde", start: "09:00", end: "10:00", coach: coachMaria },
  ];

  const futureClasses = [
    { offset: 1, nombre: "WOD Matutino", start: "06:00", end: "07:00", coach: coachDiego },
    { offset: 2, nombre: "Halterofilia", start: "17:00", end: "18:00", coach: coachMaria },
    { offset: 3, nombre: "Gimnasia", start: "18:30", end: "19:30", coach: coachDiego },
    { offset: 4, nombre: "Hyrox", start: "07:00", end: "08:00", coach: coachMaria },
    { offset: 5, nombre: "WOD Tarde", start: "09:00", end: "10:00", coach: coachDiego },
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
  const pastAttendeesByClass = new Map<string, string[]>();

  for (let i = 0; i < pastClases.length; i++) {
    const { id: claseId } = pastClases[i];
    const attendees = socioIds.slice(i % 3, (i % 3) + 6);
    const padded =
      attendees.length < 6
        ? [...attendees, ...socioIds.slice(0, 6 - attendees.length)]
        : attendees;

    pastAttendeesByClass.set(claseId, padded);
    for (const uid of padded) {
      await insertReserva(claseId, uid, "confirmada");
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

  let asistioCount = 0;
  let noAsistioCount = 0;
  for (const c of pastClases) {
    const attendees = pastAttendeesByClass.get(c.id) ?? [];
    await markPastClassAttendance(c.id, attendees);
    asistioCount += Math.max(0, attendees.length - 1);
    noAsistioCount += attendees.length > 0 ? 1 : 0;
  }

  console.log(
    `✓ ${reservaCount} reservas · pasadas: ${asistioCount} asistieron, ${noAsistioCount} no asistieron`
  );

  const futureIds = futureClases.map((c) => c.id);
  if (futureIds.length > 0) {
    const { error } = await supabase
      .from("reservas")
      .update({ estado: "confirmada" })
      .in("clase_id", futureIds)
      .in("estado", ["asistio", "no_asistio"]);
    if (error) throw error;
  }

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

  // ─── Atleta demo: Lucía (avance y estadísticas completas) ─────────────────
  const luciaId = socioIds[0];
  await supabase.from("atleta_pr_marcas").insert([
    {
      usuario_id: luciaId,
      ejercicio: "back_squat",
      record_tipo: "pr",
      valor: 225,
      unidad: "lbs",
      fecha: addDays(hoy, -3),
    },
    {
      usuario_id: luciaId,
      ejercicio: "deadlift",
      record_tipo: "pr",
      valor: 275,
      unidad: "lbs",
      fecha: addDays(hoy, -1),
    },
    {
      usuario_id: luciaId,
      ejercicio: "clean_jerk",
      record_tipo: "pr",
      valor: 155,
      unidad: "lbs",
      fecha: hoy,
    },
  ]);

  for (const skill of ["pull_ups", "chest_to_bar", "double_unders"] as const) {
    await supabase.from("atleta_skills").upsert(
      {
        usuario_id: luciaId,
        skill,
        estado: skill === "double_unders" ? "en_proceso" : "dominado",
      },
      { onConflict: "usuario_id,skill" }
    );
  }

  await supabase.from("atleta_objetivos").insert([
    {
      usuario_id: luciaId,
      nombre: "Back squat 250 lb",
      estado: "en_proceso",
      progreso_pct: 72,
      fecha_objetivo: addDays(hoy, 45),
    },
    {
      usuario_id: luciaId,
      nombre: "Primer muscle-up",
      estado: "completado",
      progreso_pct: 100,
      fecha_objetivo: addDays(hoy, -5),
    },
  ]);

  for (const c of claseRecords) {
    const { data: existing } = await supabase
      .from("reservas")
      .select("id")
      .eq("clase_id", c.id)
      .eq("usuario_id", luciaId)
      .maybeSingle();

    if (existing) {
      if (c.past) {
        await supabase
          .from("reservas")
          .update({ estado: "asistio" })
          .eq("id", existing.id);
      }
    } else if (!c.past) {
      await insertReserva(c.id, luciaId, "confirmada");
    }
  }
  console.log("✓ Atleta demo: Lucía Herrera");

  console.log("\n══════════════════════════════════════════");
  console.log("  RESET DEMO COMPLETADO");
  console.log("══════════════════════════════════════════");
  console.log(`\n  Box: ${box.name}`);
  console.log(`  Admin:    ${ADMIN_EMAIL}`);
  console.log(`  Coaches:  coach.maria@, coach.diego@`);
  console.log(`  Clases:   5 pasadas + 5 futuras (todas visibles en admin)`);
  console.log(`  Password: ${PASSWORD}`);
  console.log("\n  ── Atleta demo (progreso y estadísticas) ──");
  console.log("  Email:    lucia.herrera@email.com");
  console.log(`  Password: ${PASSWORD}`);
  console.log("  Rutas:    /mi-progreso · /mis-reservas · /perfil");
  console.log("\n══════════════════════════════════════════\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
