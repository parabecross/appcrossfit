/**
 * Seed controlado: 10 atletas QA en el box real Parabellum.
 *
 *   ATHRON_PARABELLUM_QA_CONFIRM=true npm run qa:parabellum10:seed
 *
 * No toca atletas/clases/reservas reales. Idempotente. Reversible vía teardown.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSampleWorkout } from "../src/lib/clases/sample-workouts";
import { PR_EXERCISES, SKILL_KEYS } from "../src/lib/progreso/constants";
import {
  awardAttendance,
  awardWodResult,
} from "../src/lib/ranking/engine";
import {
  PARABELLUM_BOX_ID,
  QA_ATHLETE_COUNT,
  QA_CLASS_PREFIX,
  QA_PASSWORD,
  QA_SCENARIO_NOTE,
  QA_WINDOW_FUTURE_DAYS,
  QA_WINDOW_PAST_DAYS,
  allQaEmails,
  qaAthleteEmail,
  qaAthleteName,
  type ParabellumQaSnapshot,
} from "./lib/parabellum-10-qa-constants";
import {
  addDays,
  assertOnlyQaEmails,
  assertQaEmailsOnlyOnParabellum,
  countSocios,
  listAuthUsersByEmail,
  loadSubscriptionSnapshot,
  requireParabellumQaEnv,
  resolveParabellumBox,
  saveSnapshot,
  todayInTimezone,
} from "./lib/parabellum-10-qa-env";

type ClaseRow = {
  id: string;
  fecha: string;
  nombre: string;
  cupo_maximo: number;
  hora_inicio: string;
};

const SLOTS = [
  { hora_inicio: "07:00", hora_fin: "08:00", tag: "AM" },
  { hora_inicio: "19:00", hora_fin: "20:00", tag: "PM" },
] as const;

const CUPOS = [8, 10, 12] as const;

async function ensureQaUser(
  service: SupabaseClient,
  boxId: string,
  index1Based: number,
  authByEmail: Map<string, { id: string; email: string }>
): Promise<{ profileId: string; created: boolean }> {
  const email = qaAthleteEmail(index1Based);
  const nombre = qaAthleteName(index1Based);
  let authId = authByEmail.get(email.toLowerCase())?.id;
  let created = false;

  if (!authId) {
    const { data, error } = await service.auth.admin.createUser({
      email,
      password: QA_PASSWORD,
      email_confirm: true,
      user_metadata: {
        nombre_completo: nombre,
        rol: "socio",
        box_id: boxId,
        athron_qa_scenario: "parabellum_10_athletes_v1",
      },
    });
    if (error) throw new Error(`User ${email}: ${error.message}`);
    authId = data.user!.id;
    authByEmail.set(email.toLowerCase(), { id: authId, email });
    created = true;
  } else {
    await service.auth.admin.updateUserById(authId, {
      password: QA_PASSWORD,
      email_confirm: true,
      user_metadata: {
        nombre_completo: nombre,
        rol: "socio",
        box_id: boxId,
        athron_qa_scenario: "parabellum_10_athletes_v1",
      },
    });
  }

  const { error: profileErr } = await service
    .from("profiles")
    .update({
      rol: "socio",
      box_id: boxId,
      nombre_completo: nombre,
      estado_cuenta: "activo",
    })
    .eq("user_id", authId);
  if (profileErr) throw new Error(`Profile ${email}: ${profileErr.message}`);

  const { data: profile, error: fetchErr } = await service
    .from("profiles")
    .select("id, box_id, rol")
    .eq("user_id", authId)
    .single();
  if (fetchErr || !profile) throw new Error(`Profile missing: ${email}`);
  if (profile.box_id !== boxId || profile.rol !== "socio") {
    throw new Error(`Profile ${email} no quedó como socio de Parabellum`);
  }
  return { profileId: profile.id, created };
}

async function pickMembershipPlanId(
  service: SupabaseClient,
  boxId: string
): Promise<string> {
  const preferred = ["Ilimitado", "12 clases", "8 clases"];
  for (const nombre of preferred) {
    const { data } = await service
      .from("planes")
      .select("id")
      .eq("box_id", boxId)
      .eq("nombre", nombre)
      .eq("activo", true)
      .maybeSingle();
    if (data) return data.id;
  }
  const { data, error } = await service
    .from("planes")
    .select("id")
    .eq("box_id", boxId)
    .eq("activo", true)
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    throw new Error("No hay planes activos en Parabellum para membresías QA");
  }
  return data.id;
}

async function ensureMembresia(
  service: SupabaseClient,
  usuarioId: string,
  planId: string,
  fechaInicio: string,
  fechaFin: string,
  estado: "vigente" | "vencida"
): Promise<"created" | "reused"> {
  const { data: existing } = await service
    .from("membresias")
    .select("id")
    .eq("usuario_id", usuarioId)
    .eq("plan_id", planId)
    .maybeSingle();

  if (existing) {
    await service
      .from("membresias")
      .update({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        estado,
        notas: QA_SCENARIO_NOTE,
      })
      .eq("id", existing.id);
    return "reused";
  }

  const { error } = await service.from("membresias").insert({
    usuario_id: usuarioId,
    plan_id: planId,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    estado,
    metodo_asignacion: "manual",
    notas: QA_SCENARIO_NOTE,
  });
  if (error) throw new Error(`Membresia: ${error.message}`);
  return "created";
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
  }
): Promise<{ clase: ClaseRow; created: boolean }> {
  const { data: existing } = await service
    .from("clases")
    .select("id, fecha, nombre, cupo_maximo, hora_inicio")
    .eq("box_id", params.boxId)
    .eq("nombre", params.nombre)
    .eq("fecha", params.fecha)
    .eq("hora_inicio", params.hora_inicio)
    .maybeSingle();

  if (existing) {
    return { clase: existing as ClaseRow, created: false };
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
  return { clase: data as ClaseRow, created: true };
}

async function ensureReserva(
  service: SupabaseClient,
  claseId: string,
  usuarioId: string,
  estado: "confirmada" | "asistio" | "no_asistio" | "cancelada"
): Promise<"created" | "reused"> {
  const { data: existing } = await service
    .from("reservas")
    .select("id, estado")
    .eq("clase_id", claseId)
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  if (existing) {
    if (existing.estado !== estado) {
      const { error } = await service
        .from("reservas")
        .update({ estado })
        .eq("id", existing.id);
      if (error) throw new Error(`Reserva update: ${error.message}`);
    }
    return "reused";
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
    let id = rpcId ? (rpcId as string) : null;
    if (rpcErr || !id) {
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
      id = data.id as string;
    }
    const { error: cErr } = await service
      .from("reservas")
      .update({ estado: "cancelada" })
      .eq("id", id);
    if (cErr) throw new Error(`Cancel: ${cErr.message}`);
    return "created";
  }

  const { data: rpcId, error: rpcErr } = await service.rpc("admin_insert_reserva", {
    p_clase_id: claseId,
    p_usuario_id: usuarioId,
    p_estado: estado,
  });
  if (!rpcErr && rpcId) return "created";

  const { error } = await service.from("reservas").insert({
    clase_id: claseId,
    usuario_id: usuarioId,
    estado,
  });
  if (error) throw new Error(`Reserva: ${error.message}`);
  return "created";
}

async function ensureScore(
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
    p_notas: QA_SCENARIO_NOTE,
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

async function main() {
  const { service } = requireParabellumQaEnv();
  const emails = allQaEmails();
  assertOnlyQaEmails(emails);

  console.log("ATHRON Parabellum-10-QA — seed\n");
  const box = await resolveParabellumBox(service);
  if (box.id !== PARABELLUM_BOX_ID) {
    console.error("FAIL — ID mismatch");
    process.exit(1);
  }

  const existingQa = await assertQaEmailsOnlyOnParabellum(service, box.id);
  console.log(`QA emails existentes en Parabellum: ${existingQa}`);

  const countsBefore = await countSocios(service, box.id);
  const sub = await loadSubscriptionSnapshot(service, box.id);

  console.log("\nSnapshot previo:");
  console.log(`  socios totales: ${countsBefore.total}`);
  console.log(`  atletas reales: ${countsBefore.real}`);
  console.log(`  atletas QA:     ${countsBefore.qa}`);
  console.log(`  activos:        ${countsBefore.activos}`);
  console.log(`  plan:           ${sub.planName} (${sub.planCode})`);
  console.log(`  suscripción:    ${sub.status}`);
  console.log(`  max_atletas:    ${sub.maxAtletas}`);

  const projectedActivos =
    countsBefore.activos + Math.max(0, QA_ATHLETE_COUNT - countsBefore.qa);
  if (sub.maxAtletas != null && projectedActivos > sub.maxAtletas) {
    console.error(
      `\nFAIL — sin cupo SaaS: uso proyectado ${projectedActivos} > límite ${sub.maxAtletas}. No se alteran límites.`
    );
    process.exit(1);
  }

  const snapshot: ParabellumQaSnapshot = {
    boxId: box.id,
    slug: box.slug,
    name: box.name,
    realAthleteCount: countsBefore.real,
    totalSociosBefore: countsBefore.total,
    saasPlanCode: sub.planCode,
    saasPlanName: sub.planName,
    maxAtletas: sub.maxAtletas,
    subscriptionStatus: sub.status,
    subscriptionPlanId: sub.planId,
    savedAt: new Date().toISOString(),
  };
  saveSnapshot(snapshot);

  const { data: coaches, error: coachErr } = await service
    .from("profiles")
    .select("id, nombre_completo")
    .eq("box_id", box.id)
    .eq("rol", "coach")
    .order("nombre_completo");
  if (coachErr) throw coachErr;
  if (!coaches || coaches.length === 0) {
    console.error("FAIL — Parabellum no tiene coaches; no se crean coaches QA");
    process.exit(1);
  }
  console.log(
    `\nCoaches reales usados como referencia: ${coaches.map((c) => c.nombre_completo).join(", ")}`
  );

  const today = todayInTimezone(box.timezone);
  const startDate = addDays(today, -QA_WINDOW_PAST_DAYS);
  const endDate = addDays(today, QA_WINDOW_FUTURE_DAYS);
  console.log(`\nVentana: ${startDate} → ${endDate} (hoy=${today})`);

  const authByEmail = await listAuthUsersByEmail(service);
  const socioIds: string[] = [];
  let usersCreated = 0;
  let usersReused = 0;

  for (let i = 1; i <= QA_ATHLETE_COUNT; i++) {
    const u = await ensureQaUser(service, box.id, i, authByEmail);
    socioIds.push(u.profileId);
    if (u.created) usersCreated++;
    else usersReused++;
  }

  const planId = await pickMembershipPlanId(service, box.id);
  let memCreated = 0;
  let memReused = 0;
  for (let i = 0; i < socioIds.length; i++) {
    let fechaInicio: string;
    let fechaFin: string;
    let estado: "vigente" | "vencida";
    if (i === 9) {
      fechaInicio = addDays(today, -40);
      fechaFin = addDays(today, -2);
      estado = "vencida";
    } else if (i >= 7) {
      fechaInicio = addDays(today, -20);
      fechaFin = addDays(today, 2 + (i - 7));
      estado = "vigente";
    } else {
      fechaInicio = addDays(today, -5);
      fechaFin = addDays(today, 25);
      estado = "vigente";
    }
    const r = await ensureMembresia(
      service,
      socioIds[i],
      planId,
      fechaInicio,
      fechaFin,
      estado
    );
    if (r === "created") memCreated++;
    else memReused++;
  }

  const clases: ClaseRow[] = [];
  let clasesCreated = 0;
  let clasesReused = 0;

  for (let offset = -QA_WINDOW_PAST_DAYS; offset <= QA_WINDOW_FUTURE_DAYS; offset++) {
    const fecha = addDays(today, offset);
    for (let s = 0; s < SLOTS.length; s++) {
      const slot = SLOTS[s];
      const cupo = CUPOS[(Math.abs(offset) + s) % CUPOS.length];
      const nombre = `${QA_CLASS_PREFIX} ${slot.tag} ${fecha}`;
      const coachId = coaches[(Math.abs(offset) + s) % coaches.length].id;
      const { clase, created } = await ensureClase(service, {
        boxId: box.id,
        coachId,
        nombre,
        fecha,
        hora_inicio: slot.hora_inicio,
        hora_fin: slot.hora_fin,
        cupo_maximo: cupo,
      });
      clases.push(clase);
      if (created) clasesCreated++;
      else clasesReused++;
    }
  }

  const occupied = new Map<string, number>();
  for (const c of clases) occupied.set(c.id, 0);

  const { data: existingReservas } = await service
    .from("reservas")
    .select("clase_id, estado, usuario_id")
    .in(
      "clase_id",
      clases.map((c) => c.id)
    )
    .in("usuario_id", socioIds);
  for (const r of existingReservas ?? []) {
    if (r.estado !== "cancelada") {
      occupied.set(r.clase_id, (occupied.get(r.clase_id) ?? 0) + 1);
    }
  }

  const existingKey = new Set(
    (existingReservas ?? []).map((r) => `${r.clase_id}:${r.usuario_id}`)
  );

  let reservasCreated = 0;
  let reservasReused = 0;
  const asistioKey = new Set<string>();

  for (let a = 0; a < socioIds.length; a++) {
    const usuarioId = socioIds[a];
    const target = 9 + (a % 4); // 9..12 → ~105
    let added = 0;

    for (const r of existingReservas ?? []) {
      if (r.usuario_id !== usuarioId) continue;
      added++;
      if (r.estado === "asistio") {
        asistioKey.add(`${r.clase_id}:${usuarioId}`);
      }
    }

    for (let step = 0; added < target && step < clases.length * 3; step++) {
      const clase = clases[(a * 2 + step * 3) % clases.length];
      const key = `${clase.id}:${usuarioId}`;
      if (existingKey.has(key)) continue;

      if (clase.fecha === today && a >= 8) continue;
      if (clase.fecha > today && (a + step) % 3 === 0) continue;

      const occ = occupied.get(clase.id) ?? 0;
      if (occ >= clase.cupo_maximo) continue;

      let estado: "confirmada" | "asistio" | "no_asistio" | "cancelada";
      if (clase.fecha < today) {
        const mod = (a + step) % 8;
        if (mod === 0) estado = "cancelada";
        else if (mod === 1) estado = "no_asistio";
        else estado = "asistio";
      } else {
        estado = "confirmada";
      }

      if (estado !== "cancelada") {
        occupied.set(clase.id, occ + 1);
      }

      const result = await ensureReserva(service, clase.id, usuarioId, estado);
      existingKey.add(key);
      if (result === "created") reservasCreated++;
      else reservasReused++;
      added++;

      if (estado === "asistio") {
        asistioKey.add(key);
      }
    }
  }

  const asistioPairs = [...asistioKey].map((k) => {
    const [claseId, usuarioId] = k.split(":");
    return { claseId, usuarioId };
  });

  // Scores for past asistio
  for (const pair of asistioPairs) {
    const { data: res } = await service
      .from("reservas")
      .select("id")
      .eq("clase_id", pair.claseId)
      .eq("usuario_id", pair.usuarioId)
      .eq("estado", "asistio")
      .maybeSingle();
    if (!res) continue;
    await ensureScore(
      service,
      pair.claseId,
      pair.usuarioId,
      res.id,
      String(90 + (pair.usuarioId.charCodeAt(0) % 30))
    );
  }

  // PRs + skills for first 6+ athletes
  const prPool = PR_EXERCISES.slice(0, 6);
  for (let i = 0; i < socioIds.length; i++) {
    if (i >= 8) break;
    const uid = socioIds[i];
    if (i < 6) {
      const ex = prPool[i % prPool.length];
      const { data: existingPr } = await service
        .from("atleta_pr_marcas")
        .select("id")
        .eq("usuario_id", uid)
        .eq("ejercicio", ex.key)
        .eq("record_tipo", "pr")
        .maybeSingle();
      if (!existingPr) {
        await service.from("atleta_pr_marcas").insert({
          usuario_id: uid,
          ejercicio: ex.key,
          record_tipo: "pr",
          valor: 140 + i * 5,
          unidad: ex.unit,
          fecha: addDays(today, -8 + i),
          notas: QA_SCENARIO_NOTE,
        });
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
          estado: i % 2 === 0 ? "logrado" : "en_proceso",
        });
      }
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

  // Ranking only for QA asistio reservas / scores (no full-box backfill)
  let rankingAttendance = 0;
  let rankingWod = 0;
  for (const pair of asistioPairs) {
    const { data: res } = await service
      .from("reservas")
      .select("id")
      .eq("clase_id", pair.claseId)
      .eq("usuario_id", pair.usuarioId)
      .eq("estado", "asistio")
      .maybeSingle();
    if (!res) continue;
    try {
      const r = await awardAttendance({
        reservaId: res.id,
        admin: service as Parameters<typeof awardAttendance>[0]["admin"],
      });
      if (r.awarded) rankingAttendance++;
    } catch {
      /* ignore missing ranking tables */
    }
    try {
      const r = await awardWodResult({
        claseId: pair.claseId,
        usuarioId: pair.usuarioId,
        admin: service as Parameters<typeof awardWodResult>[0]["admin"],
      });
      if (r.awarded) rankingWod++;
    } catch {
      /* ignore */
    }
  }

  const countsAfter = await countSocios(service, box.id);
  const subAfter = await loadSubscriptionSnapshot(service, box.id);

  const { count: claseQaCount } = await service
    .from("clases")
    .select("id", { count: "exact", head: true })
    .eq("box_id", box.id)
    .like("nombre", `${QA_CLASS_PREFIX}%`);

  const { data: qaClaseRows } = await service
    .from("clases")
    .select("id")
    .eq("box_id", box.id)
    .like("nombre", `${QA_CLASS_PREFIX}%`);
  const qaClaseIds = (qaClaseRows ?? []).map((c) => c.id);

  let reservaQaCount = 0;
  if (qaClaseIds.length > 0) {
    const { count } = await service
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .in("clase_id", qaClaseIds)
      .in("usuario_id", socioIds);
    reservaQaCount = count ?? 0;
  }

  console.log("\nConteos seed:");
  console.log(`  usuarios: ${usersCreated} creados / ${usersReused} reutilizados`);
  console.log(`  socios reales: ${countsAfter.real} (antes ${countsBefore.real})`);
  console.log(`  socios QA: ${countsAfter.qa}`);
  console.log(`  clases QA: ${claseQaCount} (new ${clasesCreated}, reuse ${clasesReused})`);
  console.log(`  reservas QA: ${reservaQaCount} (new ${reservasCreated}, reuse ${reservasReused})`);
  console.log(`  membresías: ${memCreated} new / ${memReused} reuse`);
  console.log(`  ranking awards: attendance=${rankingAttendance} wod=${rankingWod}`);
  console.log(
    `  suscripción intacta: ${subAfter.status === sub.status && subAfter.planId === sub.planId && subAfter.maxAtletas === sub.maxAtletas}`
  );

  const ok =
    countsAfter.real === countsBefore.real &&
    countsAfter.qa === QA_ATHLETE_COUNT &&
    (claseQaCount ?? 0) === 42 &&
    reservaQaCount >= 80 &&
    reservaQaCount <= 140 &&
    subAfter.status === sub.status &&
    subAfter.planId === sub.planId &&
    subAfter.maxAtletas === sub.maxAtletas;

  if (!ok) {
    console.error("\nFAIL — seed Parabellum-10-QA no cumplió invariantes");
    process.exit(1);
  }

  console.log("\nPASS — seed Parabellum-10-QA");
}

main().catch((err) => {
  console.error("\nFAIL —", err);
  process.exit(1);
});
