/**
 * Demo mensual Parabellum Cross — 1 mes · 10 atletas · Ranking Athron
 *
 * Pensado para presentar a clientes:
 * - Mes calendario completo (lun–sáb) con clases y scores
 * - Horario: mañana 6–9 h (3 clases) + tarde 17–21 h (4 clases), 1 h c/u
 * - Reservas realistas: ~1 clase/día por atleta (mañana O tarde; ~8% doble sesión)
 * - Constancia, rachas, posición WOD, bonus RX, evolución
 * - 4 categorías Legacy · membresías variadas · PRs/skills
 * - Ledger Athron recalculado al final
 *
 *   npm run demo
 */

import { createClient } from "@supabase/supabase-js";
import { getSampleWorkout } from "../src/lib/clases/sample-workouts";
import { PR_EXERCISES, SKILL_KEYS } from "../src/lib/progreso/constants";
import { backfillRankingForBox } from "../src/lib/ranking/engine";
import {
  DEMO_ATHLETES,
  CLASSES_PER_DAY,
  MORNING_SLOTS,
  EVENING_SLOTS,
  planAthleteDay,
  generateScore,
  listWeekdayDates,
  monthBounds,
  wodNameForSlot,
  wodScoreType,
  type ScoreDef,
} from "./demo-month-generators";
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

let supportsSinScore = true;
let supportsCalsTipo = true;

async function detectSchema() {
  const { error: sinErr } = await supabase
    .from("clase_scores")
    .select("sin_score")
    .limit(0);
  if (sinErr?.message.includes("sin_score")) supportsSinScore = false;

  const { error: calsErr } = await supabase
    .from("clase_scores")
    .select("score_tipo")
    .eq("score_tipo", "cals")
    .limit(0);
  if (calsErr?.message.includes("cals")) supportsCalsTipo = false;
}

const BOX_SLUG = "parabellum-cross";
const TIMEZONE = "America/Mexico_City";
const PASSWORD = "Parabellum2024!";
const ADMIN_EMAIL = "admin@parabellum.cross";
const FUTURE_DAYS = 3;

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
  extra?: {
    telefono?: string;
    bio?: string;
    estado_cuenta?: string;
    foto_url?: string;
  }
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
  if (extra?.foto_url) updates.foto_url = extra.foto_url;

  await supabase.from("profiles").update(updates).eq("user_id", data.user!.id);

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
  const { data: rpcId, error: rpcErr } = await supabase.rpc(
    "admin_insert_reserva",
    {
      p_clase_id: claseId,
      p_usuario_id: usuarioId,
      p_estado: estado,
    }
  );

  if (!rpcErr && rpcId) return rpcId as string;

  const { data, error } = await supabase
    .from("reservas")
    .insert({ clase_id: claseId, usuario_id: usuarioId, estado })
    .select("id")
    .single();

  if (error) {
    const hint =
      rpcErr?.message?.includes("admin_insert_reserva") ||
      rpcErr?.code === "PGRST202"
        ? " Ejecuta supabase/patch-admin-insert-reserva.sql en Supabase."
        : "";
    throw new Error(`Reserva: ${error.message}${hint}`);
  }
  return data.id as string;
}

async function insertScore(
  claseId: string,
  usuarioId: string,
  reservaId: string,
  score: ScoreDef
) {
  if ("sin_score" in score && score.sin_score) {
    if (!supportsSinScore) return;
    const { error: rpcErr } = await supabase.rpc("admin_insert_clase_score", {
      p_clase_id: claseId,
      p_usuario_id: usuarioId,
      p_reserva_id: reservaId,
      p_score_display: "—",
      p_score_tipo: "otro",
      p_valor_numerico: null,
      p_rx: true,
      p_sin_score: true,
      p_notas: score.notas ?? null,
    });
    if (!rpcErr) return;

    const { error } = await supabase.from("clase_scores").insert({
      clase_id: claseId,
      usuario_id: usuarioId,
      reserva_id: reservaId,
      score_display: "—",
      score_tipo: "otro" as const,
      valor_numerico: null,
      rx: true,
      sin_score: true,
      notas: score.notas ?? null,
    });
    if (error) throw new Error(`Score: ${error.message}`);
    return;
  }

  const s = score as Exclude<ScoreDef, { sin_score: true }>;
  let tipo = s.tipo;
  if (tipo === "cals" && !supportsCalsTipo) tipo = "reps";

  const { error: rpcErr } = await supabase.rpc("admin_insert_clase_score", {
    p_clase_id: claseId,
    p_usuario_id: usuarioId,
    p_reserva_id: reservaId,
    p_score_display: s.display,
    p_score_tipo: tipo,
    p_valor_numerico: s.valor,
    p_rx: s.rx,
    p_sin_score: false,
    p_notas: s.notas ?? null,
  });
  if (!rpcErr) return;

  const payload: Record<string, unknown> = {
    clase_id: claseId,
    usuario_id: usuarioId,
    reserva_id: reservaId,
    score_display: s.display,
    score_tipo: tipo,
    valor_numerico: s.valor,
    rx: s.rx,
    notas: s.notas ?? null,
  };
  if (supportsSinScore) payload.sin_score = false;

  const { error } = await supabase.from("clase_scores").insert(payload);
  if (error) {
    const { data: claseRow } = await supabase
      .from("clases")
      .select("id")
      .eq("id", claseId)
      .maybeSingle();
    const hint = !claseRow
      ? ` (clase ${claseId} no existe — posible corrupción de seed)`
      : "";
    throw new Error(`Score: ${error.message}${hint}`);
  }
}

async function deleteAllBoxData(
  boxId: string,
  staffIds: string[],
  boxProfileIds: string[]
) {
  await supabase.from("ranking_point_events").delete().eq("box_id", boxId);
  await supabase.from("ranking_monthly_awards").delete().eq("box_id", boxId);

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

  const claseIds = Array.from(claseIdSet);
  if (claseIds.length > 0) {
    await supabase.from("clase_scores").delete().in("clase_id", claseIds);
    await supabase.from("reservas").delete().in("clase_id", claseIds);
    await supabase.from("clases").delete().in("id", claseIds);
  }

  if (boxProfileIds.length > 0) {
    await supabase.from("clase_scores").delete().in("usuario_id", boxProfileIds);
    await supabase.from("reservas").delete().in("usuario_id", boxProfileIds);
    await supabase.from("membresias").delete().in("usuario_id", boxProfileIds);
    await supabase.from("atleta_pr_marcas").delete().in("usuario_id", boxProfileIds);
    await supabase.from("atleta_skills").delete().in("usuario_id", boxProfileIds);
    await supabase.from("atleta_objetivos").delete().in("usuario_id", boxProfileIds);
    await supabase.from("atleta_perfil_deportivo").delete().in("usuario_id", boxProfileIds);
  }

  return claseIds.length;
}

async function main() {
  const hoy = todayInTimezone(TIMEZONE);
  const { monthStart, monthEnd, monthKey } = monthBounds(TIMEZONE, hoy);
  const pastDates = listWeekdayDates(monthStart, hoy > monthEnd ? monthEnd : hoy);
  const futureDates = listWeekdayDates(addDays(hoy, 1), addDays(hoy, FUTURE_DAYS));
  const classDates = [
    ...pastDates,
    ...futureDates.filter((d) => !pastDates.includes(d) && d <= monthEnd),
  ];

  console.log("🥊 Demo mensual Parabellum — Ranking Athron\n");
  console.log(`   Mes demo: ${monthKey} · ${classDates.length} días × ${CLASSES_PER_DAY} clases/día`);
  console.log(`   Mañana 06:00–09:00 (3) · Tarde 17:00–21:00 (4)`);
  console.log(`   Reservas: 1 clase/sesión/día por atleta (no llena todos los horarios)\n`);

  await detectSchema();
  if (!supportsSinScore || !supportsCalsTipo) {
    console.log(
      "⚠ Tu BD parece tener patch-clase-scores.sql antiguo — vuelve a ejecutar patch-clase-scores.sql\n"
    );
  }
  console.log(
    "  Tip: ejecuta supabase/patch-admin-insert-reserva.sql (bypass triggers de seed).\n"
  );

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

  const deletedClases = await deleteAllBoxData(box.id, staffIds, boxProfileIds);
  console.log(`✓ Datos anteriores eliminados (${deletedClases} clases + ledger ranking)`);

  const toDelete = (profiles ?? []).filter((p) => {
    if (p.is_super_admin) return false;
    const email = emailByUserId.get(p.user_id) ?? "";
    if (email === ADMIN_EMAIL) return false;
    return p.rol === "socio" || p.rol === "coach";
  });

  for (const p of toDelete) {
    const email = emailByUserId.get(p.user_id) ?? p.nombre_completo;
    const { error } = await supabase.auth.admin.deleteUser(p.user_id);
    if (error) console.warn(`  ⚠ ${email}: ${error.message}`);
    else console.log(`  − ${email}`);
  }

  let { data: plan } = await supabase
    .from("planes")
    .select("id")
    .eq("nombre", "Mensualidad Normal")
    .eq("box_id", box.id)
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
        box_id: box.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    plan = created;
  }

  const coachMaria = await createUser(box.id, "coach.maria@parabellum.cross", "María Vega", "coach", {
    telefono: "+52 55 2345 6789",
    bio: "CrossFit L2 · Halterofilia",
    estado_cuenta: "activo",
  });
  const coachDiego = await createUser(box.id, "coach.diego@parabellum.cross", "Diego Ruiz", "coach", {
    telefono: "+52 55 3456 7890",
    bio: "Hyrox & conditioning",
    estado_cuenta: "activo",
  });
  console.log("✓ 2 coaches");

  const emailToId = new Map<string, string>();
  const socioIds: string[] = [];

  for (let i = 0; i < DEMO_ATHLETES.length; i++) {
    const a = DEMO_ATHLETES[i];
    const id = await createUser(box.id, a.email, a.nombre, "socio", {
      telefono: `+52 55 6100 ${String(1000 + i)}`,
      bio: a.story,
      estado_cuenta: "activo",
    });
    socioIds.push(id);
    emailToId.set(a.email, id);

    await supabase.from("membresias").insert({
      usuario_id: id,
      plan_id: plan!.id,
      fecha_inicio: monthStart,
      fecha_fin: addDays(hoy, a.memDays),
      estado: a.memDays < 0 ? "vencida" : "vigente",
      metodo_asignacion: "automatico",
    });

    await supabase.from("atleta_perfil_deportivo").upsert(
      {
        usuario_id: id,
        nivel_deportivo: a.level,
        disciplina: "CrossFit",
        fecha_nacimiento: `${a.birthYear}-03-15`,
        estatura_cm: 165 + (i % 4) * 3,
        peso_corporal_kg: 62 + i * 2,
        anos_entrenando: 1 + (i % 5),
        frase_legacy:
          i % 2 === 0 ? "La constancia construye campeones" : "Build your legacy",
      },
      { onConflict: "usuario_id" }
    );
  }
  console.log("✓ 10 atletas · Legacy · membresías variadas");

  const wodAttempts = new Map<string, number>();
  let reservaCount = 0;
  let scoreCount = 0;
  let classCount = 0;
  let globalClassIndex = 0;
  const fechaMoves: { id: string; fecha: string }[] = [];

  const bookingsByDate = new Map(
    classDates.map((fecha) => {
      const byAthlete = new Map(
        DEMO_ATHLETES.map((athlete) => [
          athlete.email,
          planAthleteDay(athlete, fecha, hoy),
        ])
      );
      return [fecha, byAthlete] as const;
    })
  );

  for (let dayIndex = 0; dayIndex < classDates.length; dayIndex++) {
    const fecha = classDates[dayIndex];

    const daySlots: {
      start: string;
      end: string;
      session: "morning" | "evening";
      slotIndex: number;
      coachId: string;
    }[] = [
      ...MORNING_SLOTS.map((s, slotIndex) => ({
        ...s,
        session: "morning" as const,
        slotIndex,
        coachId: coachMaria,
      })),
      ...EVENING_SLOTS.map((s, slotIndex) => ({
        ...s,
        session: "evening" as const,
        slotIndex,
        coachId: coachDiego,
      })),
    ];

    for (const slot of daySlots) {
      const wodName = wodNameForSlot(dayIndex, slot.slotIndex, slot.session);
      // Insertar en fecha futura, reservar, luego mover (evita triggers de timing)
      const insertFecha = addDays(hoy, 45 + globalClassIndex);

      const { data: clase, error } = await supabase
        .from("clases")
        .insert({
          nombre: wodName,
          fecha: insertFecha,
          hora_inicio: slot.start,
          hora_fin: slot.end,
          cupo_maximo: 16,
          coach_id: slot.coachId,
          estado: "programada",
          entrenamiento: getSampleWorkout(wodName),
        })
        .select("id")
        .single();
      if (error) throw error;
      classCount++;

      const scoreTipo = wodScoreType(wodName);
      const dayBookings = bookingsByDate.get(fecha)!;

      for (const athlete of DEMO_ATHLETES) {
        const booking = dayBookings
          .get(athlete.email)!
          .find(
            (b) =>
              b.session === slot.session && b.slotIndex === slot.slotIndex
          );
        if (!booking) continue;

        const uid = emailToId.get(athlete.email)!;
        const reservaId = await insertReserva(
          clase.id,
          uid,
          booking.decision
        );
        reservaCount++;

        if (booking.decision !== "asistio") continue;

        const attemptKey = `${athlete.email}:${wodName}`;
        const attempt = (wodAttempts.get(attemptKey) ?? 0) + 1;
        wodAttempts.set(attemptKey, attempt);

        const score = generateScore(
          athlete,
          wodName,
          scoreTipo,
          attempt,
          supportsCalsTipo
        );
        await insertScore(clase.id, uid, reservaId, score);
        if (!("sin_score" in score && score.sin_score)) scoreCount++;
      }

      fechaMoves.push({ id: clase.id, fecha });
      globalClassIndex++;
    }
  }

  for (const { id, fecha } of fechaMoves) {
    const { error } = await supabase.from("clases").update({ fecha }).eq("id", id);
    if (error) throw new Error(`Clase fecha: ${error.message}`);
  }

  console.log(`✓ ${classCount} clases · ${reservaCount} reservas · ${scoreCount} scores`);

  const prPool = PR_EXERCISES.slice(0, 6);
  for (let i = 0; i < socioIds.length; i++) {
    const uid = socioIds[i];
    const prDay = addDays(monthStart, 3 + (i % 20));
    await supabase.from("atleta_pr_marcas").insert([
      {
        usuario_id: uid,
        ejercicio: prPool[i % prPool.length].key,
        record_tipo: "pr",
        valor: 135 + i * 12 + (i % 3) * 5,
        unidad: prPool[i % prPool.length].unit,
        fecha: prDay,
      },
    ]);
    if (i % 2 === 0) {
      await supabase.from("atleta_pr_marcas").insert({
        usuario_id: uid,
        ejercicio: prPool[(i + 1) % prPool.length].key,
        record_tipo: "pr",
        valor: 150 + i * 10,
        unidad: prPool[(i + 1) % prPool.length].unit,
        fecha: addDays(prDay, 12),
      });
    }
    await supabase.from("atleta_skills").insert({
      usuario_id: uid,
      skill: SKILL_KEYS[i % SKILL_KEYS.length],
      estado: i % 3 === 0 ? "dominado" : "en_proceso",
    });
  }
  console.log("✓ PRs y skills repartidos en el mes");
  console.log("⏳ Recalculando ledger Athron (varios minutos con 7 clases/día)…");

  try {
    const ledger = await backfillRankingForBox(
      box.id,
      supabase as Parameters<typeof backfillRankingForBox>[1]
    );
    console.log(
      `✓ Ranking Athron ledger: ${ledger.attendance} asistencias · ${ledger.wod} WODs`
    );
  } catch (e) {
    console.warn(
      "⚠ Ranking ledger no generado — ejecuta patch-ranking-athron-v1.sql"
    );
    console.warn(e);
  }

  const vigente = DEMO_ATHLETES.filter((a) => a.memDays >= 5).length;
  const porVencer = DEMO_ATHLETES.filter((a) => a.memDays >= 0 && a.memDays < 5).length;
  const vencida = DEMO_ATHLETES.filter((a) => a.memDays < 0).length;

  console.log("\n══════════════════════════════════════════");
  console.log("  DEMO MENSUAL COMPLETADA");
  console.log("══════════════════════════════════════════");
  console.log(`\n  Box:      ${box.name}`);
  console.log(`  Mes:      ${monthKey}`);
  console.log(`  Clases:   ~${classDates.length * CLASSES_PER_DAY} (${CLASSES_PER_DAY}/día: 3 mañana + 4 tarde)`);
  console.log(`  Membresías: ${vigente} vigentes · ${porVencer} por vencer · ${vencida} vencidas`);
  console.log(`  Password: ${PASSWORD}`);
  console.log("\n  ── Horario ──");
  console.log("    Mañana 06:00 · 07:00 · 08:00 (1 h, coach María)");
  console.log("    Tarde  17:00 · 18:00 · 19:00 · 20:00 (1 h, coach Diego)");
  console.log("\n  ── Presentación a clientes ──");
  console.log("  /es/ranking                    → ranking mensual + historial diario");
  console.log("  /es/ranking?category=beginner  → Sofía lidera por constancia");
  console.log("  /es/ranking?category=rx        → Miguel vs Carla (+ bonus RX)");
  console.log("  /es/admin/ranking              → config · premios · compartir");
  console.log("  /es/mis-reservas               → widget puntos (login socio)");
  console.log("\n  ── Cuentas ──");
  console.log(`  Admin:  ${ADMIN_EMAIL}`);
  console.log(`  Coach:  coach.maria@ / coach.diego@parabellum.cross`);
  console.log("  Socios: lucia.herrera@, sofia.lopez@, miguel.ramos@, … (@email.com)");
  console.log("\n  ── Historias del mes (para la demo) ──");
  for (const a of DEMO_ATHLETES) {
    console.log(`  ${a.nombre.padEnd(18)} ${a.level.padEnd(14)} ${a.story}`);
  }
  console.log("\n══════════════════════════════════════════\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
