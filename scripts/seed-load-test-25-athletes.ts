/**
 * Seed rápido: box ATHRON Load Test 25 (exactamente 25 atletas).
 *
 *   ATHRON_LOAD_TEST_CONFIRM=true npm run loadtest:25:seed
 *
 * Idempotente. Solo toca slug athron-load-test-25 y correos loadtest25.*.
 * No imprime secretos de infra.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSampleWorkout } from "../src/lib/clases/sample-workouts";
import { PR_EXERCISES, SKILL_KEYS } from "../src/lib/progreso/constants";
import { backfillRankingForBox } from "../src/lib/ranking/engine";
import {
  LOAD_TEST_ADMIN_EMAIL,
  LOAD_TEST_ATHLETE_NAMES,
  LOAD_TEST_CLASS_PREFIX,
  LOAD_TEST_COACH_EMAILS,
  LOAD_TEST_CONCURRENCY_CLASS,
  LOAD_TEST_NAME,
  LOAD_TEST_NOTES,
  LOAD_TEST_PASSWORD,
  LOAD_TEST_PLAN_NAMES,
  LOAD_TEST_SLUG,
  LOAD_TEST_TARGET_ATHLETES,
  LOAD_TEST_TIMEZONE,
  athleteEmail,
  allLoadTestEmails,
  assertLoadTestEmail,
} from "./lib/load-test-25-constants";
import {
  addDays,
  assertOnlyLoadTestEmails,
  listAuthUsersByEmail,
  requireLoadTestEnv,
  todayInTimezone,
} from "./lib/load-test-25-env";

type BoxRow = { id: string; name: string; slug: string };
type Role = "admin" | "coach" | "socio";
type ClaseRow = {
  id: string;
  fecha: string;
  nombre: string;
  cupo_maximo: number;
  hora_inicio: string;
};

type Counters = {
  usersCreated: number;
  usersReused: number;
  clasesCreated: number;
  clasesReused: number;
  reservasCreated: number;
  reservasReused: number;
  membresiasCreated: number;
  membresiasReused: number;
};

const CLASS_SLOTS = [
  { hora_inicio: "06:00", hora_fin: "07:00" },
  { hora_inicio: "07:00", hora_fin: "08:00" },
  { hora_inicio: "09:00", hora_fin: "10:00" },
  { hora_inicio: "18:00", hora_fin: "19:00" },
  { hora_inicio: "20:00", hora_fin: "21:00" },
] as const;

const CUPO_CYCLE = [8, 12, 15] as const;
const CLASS_BASES = ["Strength", "Conditioning", "Engine", "Gymnastics", "Open"] as const;

function emptyCounters(): Counters {
  return {
    usersCreated: 0,
    usersReused: 0,
    clasesCreated: 0,
    clasesReused: 0,
    reservasCreated: 0,
    reservasReused: 0,
    membresiasCreated: 0,
    membresiasReused: 0,
  };
}

async function ensureBox(service: SupabaseClient): Promise<{
  box: BoxRow;
  created: boolean;
}> {
  const { data: existing, error: findErr } = await service
    .from("boxes")
    .select("id, name, slug")
    .eq("slug", LOAD_TEST_SLUG)
    .maybeSingle();

  if (findErr) throw new Error(`Box lookup: ${findErr.message}`);
  if (existing) {
    if (existing.slug !== LOAD_TEST_SLUG) {
      throw new Error(`Slug mismatch: ${existing.slug}`);
    }
    const { error: updErr } = await service
      .from("boxes")
      .update({
        name: LOAD_TEST_NAME,
        status: "active",
        timezone: LOAD_TEST_TIMEZONE,
      })
      .eq("id", existing.id);
    if (updErr) throw new Error(`Box update: ${updErr.message}`);
    return {
      box: { ...existing, name: LOAD_TEST_NAME },
      created: false,
    };
  }

  const { data, error } = await service
    .from("boxes")
    .insert({
      name: LOAD_TEST_NAME,
      slug: LOAD_TEST_SLUG,
      status: "active",
      plan: "pro",
      timezone: LOAD_TEST_TIMEZONE,
    })
    .select("id, name, slug")
    .single();

  if (error) throw new Error(`Box create: ${error.message}`);
  if (data.slug !== LOAD_TEST_SLUG) {
    throw new Error(`Box creado con slug incorrecto: ${data.slug}`);
  }
  return { box: data, created: true };
}

/**
 * Suscripción SaaS Pro (ranking/progreso). El target de capacidad bajo prueba
 * es 25 atletas (documentado en notes); el clamp a 25 se aplica en verify.
 */
async function ensureSaasSubscription(
  service: SupabaseClient,
  boxId: string
): Promise<void> {
  const { data: proPlan, error: planErr } = await service
    .from("plans")
    .select("id")
    .eq("code", "pro")
    .single();

  if (planErr || !proPlan) {
    throw new Error(
      "No se encontró plan SaaS code=pro. Ejecuta migration-athron-plans-v1.sql."
    );
  }

  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30);

  const { error } = await service.from("box_subscriptions").upsert(
    {
      box_id: boxId,
      plan_id: proPlan.id,
      status: "active",
      current_period_end: periodEnd.toISOString(),
      notes: LOAD_TEST_NOTES,
    },
    { onConflict: "box_id" }
  );
  if (error) throw new Error(`box_subscriptions: ${error.message}`);

  const { error: rankingErr } = await service
    .from("ranking_config")
    .upsert({ box_id: boxId, enabled: true }, { onConflict: "box_id" });

  if (rankingErr && !rankingErr.message.includes("ranking_config")) {
    throw new Error(`ranking_config: ${rankingErr.message}`);
  }
}

async function ensureUser(
  service: SupabaseClient,
  boxId: string,
  user: { email: string; nombre: string; rol: Role },
  counters: Counters,
  authByEmail: Map<string, string>
): Promise<{ profileId: string; authUserId: string }> {
  assertLoadTestEmail(user.email);

  let authUserId = authByEmail.get(user.email.toLowerCase());

  if (!authUserId) {
    const { data, error } = await service.auth.admin.createUser({
      email: user.email,
      password: LOAD_TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        nombre_completo: user.nombre,
        rol: user.rol,
        box_id: boxId,
      },
    });
    if (error) throw new Error(`User ${user.email}: ${error.message}`);
    authUserId = data.user!.id;
    authByEmail.set(user.email.toLowerCase(), authUserId);
    counters.usersCreated++;
  } else {
    const { error: updateErr } = await service.auth.admin.updateUserById(
      authUserId,
      {
        password: LOAD_TEST_PASSWORD,
        email_confirm: true,
        user_metadata: {
          nombre_completo: user.nombre,
          rol: user.rol,
          box_id: boxId,
        },
      }
    );
    if (updateErr) {
      throw new Error(`User update ${user.email}: ${updateErr.message}`);
    }
    counters.usersReused++;
  }

  const { error: profileErr } = await service
    .from("profiles")
    .update({
      rol: user.rol,
      box_id: boxId,
      nombre_completo: user.nombre,
      estado_cuenta: "activo",
    })
    .eq("user_id", authUserId);

  if (profileErr) {
    throw new Error(`Profile ${user.email}: ${profileErr.message}`);
  }

  const { data: profile, error: fetchErr } = await service
    .from("profiles")
    .select("id, box_id")
    .eq("user_id", authUserId)
    .single();

  if (fetchErr || !profile) {
    throw new Error(`Profile not found: ${user.email}`);
  }
  if (profile.box_id !== boxId) {
    throw new Error(
      `Profile ${user.email} asociado a box incorrecto ${profile.box_id}`
    );
  }

  return { profileId: profile.id, authUserId };
}

async function ensureMembershipPlan(
  service: SupabaseClient,
  boxId: string,
  planName: string,
  precio: number
): Promise<string> {
  const { data: existing, error: findErr } = await service
    .from("planes")
    .select("id")
    .eq("box_id", boxId)
    .eq("nombre", planName)
    .maybeSingle();

  if (findErr) throw new Error(`Plan lookup: ${findErr.message}`);
  if (existing) return existing.id;

  const { data, error } = await service
    .from("planes")
    .insert({
      nombre: planName,
      tipo: "mensual_fijo",
      duracion_dias: 30,
      precio,
      activo: true,
      box_id: boxId,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Plan ${planName}: ${error.message}`);
  return data.id;
}

async function ensureMembresia(
  service: SupabaseClient,
  usuarioId: string,
  planId: string,
  fechaInicio: string,
  fechaFin: string,
  estado: "vigente" | "vencida",
  counters: Counters
): Promise<void> {
  const { data: existing, error: findErr } = await service
    .from("membresias")
    .select("id")
    .eq("usuario_id", usuarioId)
    .eq("plan_id", planId)
    .maybeSingle();

  if (findErr) throw new Error(`Membresia lookup: ${findErr.message}`);
  if (existing) {
    const { error: updErr } = await service
      .from("membresias")
      .update({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        estado,
        notas: LOAD_TEST_NOTES,
      })
      .eq("id", existing.id);
    if (updErr) throw new Error(`Membresia update: ${updErr.message}`);
    counters.membresiasReused++;
    return;
  }

  const { error } = await service.from("membresias").insert({
    usuario_id: usuarioId,
    plan_id: planId,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    estado,
    metodo_asignacion: "manual",
    notas: LOAD_TEST_NOTES,
  });
  if (error) throw new Error(`Membresia insert: ${error.message}`);
  counters.membresiasCreated++;
}

async function ensureClase(
  service: SupabaseClient,
  params: {
    boxId: string;
    coachId: string;
    nombre: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    cupo_maximo: number;
  },
  counters: Counters
): Promise<ClaseRow> {
  const { data: existing, error: findErr } = await service
    .from("clases")
    .select("id, fecha, nombre, cupo_maximo, hora_inicio")
    .eq("box_id", params.boxId)
    .eq("nombre", params.nombre)
    .eq("fecha", params.fecha)
    .eq("hora_inicio", params.hora_inicio)
    .maybeSingle();

  if (findErr) throw new Error(`Clase lookup: ${findErr.message}`);
  if (existing) {
    counters.clasesReused++;
    return existing as ClaseRow;
  }

  const { data, error } = await service
    .from("clases")
    .insert({
      nombre: params.nombre,
      fecha: params.fecha,
      hora_inicio: params.hora_inicio,
      hora_fin: params.hora_fin,
      cupo_maximo: params.cupo_maximo,
      box_id: params.boxId,
      coach_id: params.coachId,
      estado: "programada",
      entrenamiento: getSampleWorkout(params.nombre),
    })
    .select("id, fecha, nombre, cupo_maximo, hora_inicio")
    .single();

  if (error) throw new Error(`Clase ${params.nombre}: ${error.message}`);
  counters.clasesCreated++;
  return data as ClaseRow;
}

async function insertReserva(
  service: SupabaseClient,
  claseId: string,
  usuarioId: string,
  estado: "confirmada" | "asistio" | "no_asistio" | "cancelada",
  counters: Counters
): Promise<string> {
  const { data: existing, error: findErr } = await service
    .from("reservas")
    .select("id, estado")
    .eq("clase_id", claseId)
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  if (findErr) throw new Error(`Reserva lookup: ${findErr.message}`);

  if (existing) {
    if (existing.estado !== estado) {
      const { error: updErr } = await service
        .from("reservas")
        .update({ estado })
        .eq("id", existing.id);
      if (updErr) throw new Error(`Reserva update: ${updErr.message}`);
    }
    counters.reservasReused++;
    return existing.id;
  }

  if (estado === "cancelada") {
    const { data: rpcId, error: rpcErr } = await service.rpc(
      "admin_insert_reserva",
      {
        p_clase_id: claseId,
        p_usuario_id: usuarioId,
        p_estado: "confirmada",
      }
    );

    let reservaId: string | null = rpcId ? (rpcId as string) : null;
    if (rpcErr || !reservaId) {
      const { data, error } = await service
        .from("reservas")
        .insert({
          clase_id: claseId,
          usuario_id: usuarioId,
          estado: "confirmada",
        })
        .select("id")
        .single();
      if (error) throw new Error(`Reserva: ${error.message}`);
      reservaId = data.id as string;
    }

    const { error: cancelErr } = await service
      .from("reservas")
      .update({ estado: "cancelada" })
      .eq("id", reservaId);
    if (cancelErr) throw new Error(`Reserva cancel: ${cancelErr.message}`);
    counters.reservasCreated++;
    return reservaId;
  }

  const { data: rpcId, error: rpcErr } = await service.rpc("admin_insert_reserva", {
    p_clase_id: claseId,
    p_usuario_id: usuarioId,
    p_estado: estado,
  });

  if (!rpcErr && rpcId) {
    counters.reservasCreated++;
    return rpcId as string;
  }

  const { data, error } = await service
    .from("reservas")
    .insert({ clase_id: claseId, usuario_id: usuarioId, estado })
    .select("id")
    .single();

  if (error) {
    const hint =
      rpcErr?.message?.includes("admin_insert_reserva") || rpcErr?.code === "PGRST202"
        ? " Ejecuta supabase/patch-admin-insert-reserva.sql."
        : "";
    throw new Error(`Reserva: ${error.message}${hint}`);
  }

  counters.reservasCreated++;
  return data.id;
}

async function insertScore(
  service: SupabaseClient,
  claseId: string,
  usuarioId: string,
  reservaId: string,
  display: string
): Promise<void> {
  const { data: existing } = await service
    .from("clase_scores")
    .select("id")
    .eq("clase_id", claseId)
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  if (existing) return;

  const { error: rpcErr } = await service.rpc("admin_insert_clase_score", {
    p_clase_id: claseId,
    p_usuario_id: usuarioId,
    p_reserva_id: reservaId,
    p_score_display: display,
    p_score_tipo: "reps",
    p_valor_numerico: parseInt(display, 10) || 100,
    p_rx: true,
    p_sin_score: false,
    p_notas: null,
  });
  if (!rpcErr) return;

  const { error } = await service.from("clase_scores").insert({
    clase_id: claseId,
    usuario_id: usuarioId,
    reserva_id: reservaId,
    score_display: display,
    score_tipo: "reps",
    valor_numerico: parseInt(display, 10) || 100,
    rx: true,
    sin_score: false,
  });
  if (error && !error.message.includes("does not exist")) {
    throw new Error(`clase_scores: ${error.message}`);
  }
}

async function ensurePrAndSkills(
  service: SupabaseClient,
  socioIds: string[],
  today: string
): Promise<void> {
  const prPool = PR_EXERCISES.slice(0, 6);

  for (let i = 0; i < socioIds.length; i++) {
    const uid = socioIds[i];
    const ejercicio = prPool[i % prPool.length];

    const { data: existingPr } = await service
      .from("atleta_pr_marcas")
      .select("id")
      .eq("usuario_id", uid)
      .eq("ejercicio", ejercicio.key)
      .eq("record_tipo", "pr")
      .maybeSingle();

    if (!existingPr) {
      const { error } = await service.from("atleta_pr_marcas").insert({
        usuario_id: uid,
        ejercicio: ejercicio.key,
        record_tipo: "pr",
        valor: 135 + i * 5,
        unidad: ejercicio.unit,
        fecha: addDays(today, -14 + (i % 10)),
      });
      if (error && !error.message.includes("does not exist")) {
        throw new Error(`atleta_pr_marcas: ${error.message}`);
      }
    }

    if (i % 2 === 0) {
      const ejercicio2 = prPool[(i + 1) % prPool.length];
      const { data: existingRm } = await service
        .from("atleta_pr_marcas")
        .select("id")
        .eq("usuario_id", uid)
        .eq("ejercicio", ejercicio2.key)
        .eq("record_tipo", "rm")
        .maybeSingle();
      if (!existingRm) {
        await service.from("atleta_pr_marcas").insert({
          usuario_id: uid,
          ejercicio: ejercicio2.key,
          record_tipo: "rm",
          valor: 155 + i * 5,
          unidad: ejercicio2.unit,
          fecha: addDays(today, -7 + (i % 7)),
        });
      }
    }

    const skill = SKILL_KEYS[i % SKILL_KEYS.length];
    const { data: existingSkill } = await service
      .from("atleta_skills")
      .select("id")
      .eq("usuario_id", uid)
      .eq("skill", skill)
      .maybeSingle();

    if (!existingSkill) {
      await service.from("atleta_skills").insert({
        usuario_id: uid,
        skill,
        estado: i % 3 === 0 ? "dominado" : i % 2 === 0 ? "logrado" : "en_proceso",
      });
    }

    await service.from("atleta_perfil_deportivo").upsert(
      {
        usuario_id: uid,
        nivel_deportivo: (["beginner", "intermediate", "advanced", "rx"] as const)[
          i % 4
        ],
        disciplina: "CrossFit",
      },
      { onConflict: "usuario_id" }
    );
  }
}

async function main() {
  const { service } = requireLoadTestEnv();
  const today = todayInTimezone(LOAD_TEST_TIMEZONE);
  const counters = emptyCounters();
  const emails = allLoadTestEmails();
  assertOnlyLoadTestEmails(emails);

  console.log("ATHRON load-test-25 — seed");
  console.log(`  slug=${LOAD_TEST_SLUG}`);
  console.log(`  timezone=${LOAD_TEST_TIMEZONE}`);
  console.log(`  target_atletas=${LOAD_TEST_TARGET_ATHLETES}`);
  console.log(`  fecha_ref=${today}\n`);

  const { box, created: boxCreated } = await ensureBox(service);
  console.log(
    `Box ${boxCreated ? "creado" : "reutilizado"}: ${box.name} (${box.id})`
  );

  await ensureSaasSubscription(service, box.id);

  const authByEmail = await listAuthUsersByEmail(service);

  const admin = await ensureUser(
    service,
    box.id,
    {
      email: LOAD_TEST_ADMIN_EMAIL,
      nombre: "Load Test Admin",
      rol: "admin",
    },
    counters,
    authByEmail
  );

  const coachIds: string[] = [];
  for (let i = 0; i < LOAD_TEST_COACH_EMAILS.length; i++) {
    const c = await ensureUser(
      service,
      box.id,
      {
        email: LOAD_TEST_COACH_EMAILS[i],
        nombre: `Load Test Coach ${String(i + 1).padStart(3, "0")}`,
        rol: "coach",
      },
      counters,
      authByEmail
    );
    coachIds.push(c.profileId);
  }

  const socioIds: string[] = [];
  for (let i = 0; i < LOAD_TEST_TARGET_ATHLETES; i++) {
    const s = await ensureUser(
      service,
      box.id,
      {
        email: athleteEmail(i + 1),
        nombre: LOAD_TEST_ATHLETE_NAMES[i],
        rol: "socio",
      },
      counters,
      authByEmail
    );
    socioIds.push(s.profileId);
  }

  if (socioIds.length !== LOAD_TEST_TARGET_ATHLETES) {
    throw new Error(
      `Se esperaban ${LOAD_TEST_TARGET_ATHLETES} socios, hay ${socioIds.length}`
    );
  }

  await service
    .from("boxes")
    .update({ owner_user_id: admin.authUserId })
    .eq("id", box.id);

  const planIds: string[] = [];
  const precios = [1899, 1499, 1199];
  for (let i = 0; i < LOAD_TEST_PLAN_NAMES.length; i++) {
    planIds.push(
      await ensureMembershipPlan(
        service,
        box.id,
        LOAD_TEST_PLAN_NAMES[i],
        precios[i]
      )
    );
  }

  for (let i = 0; i < socioIds.length; i++) {
    const planId = planIds[i % planIds.length];
    let fechaInicio: string;
    let fechaFin: string;
    let estado: "vigente" | "vencida";

    if (i < 15) {
      fechaInicio = addDays(today, -10);
      fechaFin = addDays(today, 20);
      estado = "vigente";
    } else if (i < 20) {
      fechaInicio = addDays(today, -25);
      fechaFin = addDays(today, 1 + (i - 15));
      estado = "vigente";
    } else {
      fechaInicio = addDays(today, -45);
      fechaFin = addDays(today, -3 - (i - 20));
      estado = "vencida";
    }

    await ensureMembresia(
      service,
      socioIds[i],
      planId,
      fechaInicio,
      fechaFin,
      estado,
      counters
    );
  }

  const clases: ClaseRow[] = [];
  for (let dayOffset = -7; dayOffset <= 6; dayOffset++) {
    const fecha = addDays(today, dayOffset);
    const slotsToday = 3 + (Math.abs(dayOffset) % 3); // 3..5
    for (let s = 0; s < slotsToday; s++) {
      const slot = CLASS_SLOTS[s % CLASS_SLOTS.length];
      const base = CLASS_BASES[(Math.abs(dayOffset) + s) % CLASS_BASES.length];
      const cupo = CUPO_CYCLE[(Math.abs(dayOffset) + s) % CUPO_CYCLE.length];
      const nombre = `${LOAD_TEST_CLASS_PREFIX}${base} D${dayOffset >= 0 ? `p${dayOffset}` : `m${Math.abs(dayOffset)}`} S${s + 1}`;

      clases.push(
        await ensureClase(
          service,
          {
            boxId: box.id,
            coachId: coachIds[(Math.abs(dayOffset) + s) % coachIds.length],
            nombre,
            fecha,
            hora_inicio: slot.hora_inicio,
            hora_fin: slot.hora_fin,
            cupo_maximo: cupo,
          },
          counters
        )
      );
    }
  }

  await ensureClase(
    service,
    {
      boxId: box.id,
      coachId: coachIds[0],
      nombre: LOAD_TEST_CONCURRENCY_CLASS,
      fecha: addDays(today, 3),
      hora_inicio: "12:00",
      hora_fin: "13:00",
      cupo_maximo: 10,
    },
    counters
  );

  const uniqueClases = Array.from(
    new Map(clases.map((c) => [c.id, c])).values()
  ).sort((a, b) =>
    `${a.fecha}${a.hora_inicio}${a.nombre}`.localeCompare(
      `${b.fecha}${b.hora_inicio}${b.nombre}`
    )
  );

  const reservaRecords: Array<{
    id: string;
    clase_id: string;
    usuario_id: string;
    estado: string;
    fecha: string;
  }> = [];

  const occupiedByClase = new Map<string, number>();
  for (const c of uniqueClases) occupiedByClase.set(c.id, 0);

  for (let s = 0; s < socioIds.length; s++) {
    const numReservas = 6 + (s % 3); // 6..8 → ~175 total
    let added = 0;
    for (
      let idx = s;
      idx < uniqueClases.length && added < numReservas;
      idx += 3
    ) {
      const clase = uniqueClases[idx];
      const occ = occupiedByClase.get(clase.id) ?? 0;
      if (occ >= clase.cupo_maximo) continue;

      const isPast = clase.fecha < today;
      let estado: "confirmada" | "asistio" | "no_asistio" | "cancelada";
      const mod = (s + added) % 7;
      if (!isPast) {
        estado = mod === 0 ? "cancelada" : "confirmada";
      } else if (mod === 0) {
        estado = "cancelada";
      } else if (mod === 1) {
        estado = "no_asistio";
      } else {
        estado = "asistio";
      }

      if (estado !== "cancelada") {
        occupiedByClase.set(clase.id, occ + 1);
      }

      const reservaId = await insertReserva(
        service,
        clase.id,
        socioIds[s],
        estado,
        counters
      );
      reservaRecords.push({
        id: reservaId,
        clase_id: clase.id,
        usuario_id: socioIds[s],
        estado,
        fecha: clase.fecha,
      });
      added++;
    }
  }

  for (const rec of reservaRecords) {
    if (rec.estado !== "asistio" || rec.fecha >= today) continue;
    await insertScore(
      service,
      rec.clase_id,
      rec.usuario_id,
      rec.id,
      String(80 + (rec.usuario_id.charCodeAt(0) % 40))
    );
  }

  await ensurePrAndSkills(service, socioIds.slice(0, 18), today);

  try {
    const ledger = await backfillRankingForBox(
      box.id,
      service as Parameters<typeof backfillRankingForBox>[1]
    );
    console.log(
      `Ranking ledger: ${ledger.attendance} asistencias · ${ledger.wod} WODs`
    );
  } catch (e) {
    console.warn("⚠ Ranking ledger no generado:", e);
  }

  const { count: socioCount } = await service
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("box_id", box.id)
    .eq("rol", "socio");

  const { count: claseCount } = await service
    .from("clases")
    .select("id", { count: "exact", head: true })
    .eq("box_id", box.id);

  const { data: boxClases } = await service
    .from("clases")
    .select("id")
    .eq("box_id", box.id);
  const claseIds = (boxClases ?? []).map((c) => c.id);

  let reservaCount = 0;
  if (claseIds.length > 0) {
    const { count } = await service
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .in("clase_id", claseIds);
    reservaCount = count ?? 0;
  }

  const { count: membresiaCount } = await service
    .from("membresias")
    .select("id", { count: "exact", head: true })
    .in("usuario_id", socioIds);

  console.log("\nConteos finales:");
  console.log(`  usuarios creados/reutilizados: ${counters.usersCreated}/${counters.usersReused}`);
  console.log(`  socios en box: ${socioCount}`);
  console.log(`  coaches: ${coachIds.length}`);
  console.log(`  clases: ${claseCount} (new ${counters.clasesCreated}, reuse ${counters.clasesReused})`);
  console.log(`  reservas: ${reservaCount} (new ${counters.reservasCreated}, reuse ${counters.reservasReused})`);
  console.log(`  membresías: ${membresiaCount}`);

  const ok =
    socioCount === LOAD_TEST_TARGET_ATHLETES &&
    coachIds.length === 2 &&
    (reservaCount ?? 0) >= 100 &&
    (reservaCount ?? 0) <= 250;

  if (!ok) {
    console.error("\nFAIL — seed no cumple rangos esperados");
    process.exit(1);
  }

  console.log("\nPASS — load-test-25 seed completado");
}

main().catch((err) => {
  console.error("\nFAIL —", err);
  process.exit(1);
});
