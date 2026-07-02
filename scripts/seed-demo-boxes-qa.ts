/**
 * Seed QA manual multi-box: Parabellum Cross + QA Demo Box Beta.
 *
 *   ATHRON_QA_CONFIRM=true npm run seed-demo-boxes
 *
 * Idempotente: búsqueda antes de crear (no borrar-y-recrear).
 * Solo toca datos con prefijos QA documentados.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSampleWorkout } from "../src/lib/clases/sample-workouts";
import {
  BETA_CLASS_PREFIX,
  BETA_EMAILS,
  BETA_NAME,
  BETA_PLAN_NAME,
  BETA_SLUG,
  PARABELLUM_CLASS_PREFIX,
  PARABELLUM_EMAILS,
  PARABELLUM_PLAN_NAME,
  PARABELLUM_SLUG,
  QA_PASSWORD,
} from "./lib/qa-demo-boxes-constants";
import { requireQaScriptEnv } from "./lib/qa-demo-boxes-env";

const TIMEZONE = "America/Mexico_City";

type BoxRow = { id: string; name: string; slug: string };
type SeedCounters = {
  usersCreated: number;
  usersReused: number;
  clasesCreated: number;
  clasesReused: number;
  reservasCreated: number;
  reservasReused: number;
};

type QaUserRow = {
  email: string;
  nombre: string;
  rol: "admin" | "coach" | "socio";
};

type ClaseRow = {
  id: string;
  fecha: string;
  nombre: string;
  cupo_maximo: number;
};

function emptyCounters(): SeedCounters {
  return {
    usersCreated: 0,
    usersReused: 0,
    clasesCreated: 0,
    clasesReused: 0,
    reservasCreated: 0,
    reservasReused: 0,
  };
}

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
  return dt.toISOString().slice(0, 10);
}

function dateRange(fromOffset: number, toOffset: number, today: string): string[] {
  const dates: string[] = [];
  for (let offset = fromOffset; offset <= toOffset; offset++) {
    dates.push(addDays(today, offset));
  }
  return dates;
}

async function listAuthUsersByEmail(service: SupabaseClient) {
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

async function findParabellumBox(service: SupabaseClient): Promise<BoxRow> {
  const { data, error } = await service
    .from("boxes")
    .select("id, name, slug")
    .eq("slug", PARABELLUM_SLUG);

  if (error) throw new Error(`Parabellum lookup: ${error.message}`);
  if (!data || data.length !== 1) {
    console.error(
      `Abortado: se esperaba exactamente 1 box con slug "${PARABELLUM_SLUG}", encontrados ${data?.length ?? 0}.`
    );
    process.exit(1);
  }

  return data[0];
}

async function ensureBetaBox(
  service: SupabaseClient
): Promise<{ box: BoxRow; created: boolean }> {
  const { data: existing, error: findErr } = await service
    .from("boxes")
    .select("id, name, slug")
    .eq("slug", BETA_SLUG)
    .maybeSingle();

  if (findErr) throw new Error(`Beta lookup: ${findErr.message}`);
  if (existing) return { box: existing, created: false };

  const { data, error } = await service
    .from("boxes")
    .insert({
      name: BETA_NAME,
      slug: BETA_SLUG,
      status: "active",
      plan: "free",
      timezone: TIMEZONE,
    })
    .select("id, name, slug")
    .single();

  if (error) throw new Error(`Beta create: ${error.message}`);
  return { box: data, created: true };
}

async function ensureBoxSubscriptionPro(
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
      "No se encontró plan ATHRON Pro (code=pro). Ejecuta migration-athron-plans-v1.sql."
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

async function ensureQaUser(
  service: SupabaseClient,
  boxId: string,
  user: QaUserRow,
  counters: SeedCounters
): Promise<string> {
  const authByEmail = await listAuthUsersByEmail(service);
  let authId = authByEmail.get(user.email.toLowerCase());
  let created = false;

  if (!authId) {
    const { data, error } = await service.auth.admin.createUser({
      email: user.email,
      password: QA_PASSWORD,
      email_confirm: true,
      user_metadata: {
        nombre_completo: user.nombre,
        rol: user.rol,
        box_id: boxId,
      },
    });
    if (error) throw new Error(`User ${user.email}: ${error.message}`);
    authId = data.user!.id;
    created = true;
  }

  const { error: profileErr } = await service
    .from("profiles")
    .update({
      rol: user.rol,
      box_id: boxId,
      nombre_completo: user.nombre,
      estado_cuenta: "activo",
    })
    .eq("user_id", authId);

  if (profileErr) throw new Error(`Profile ${user.email}: ${profileErr.message}`);

  const { data: profile, error: fetchErr } = await service
    .from("profiles")
    .select("id")
    .eq("user_id", authId)
    .single();

  if (fetchErr || !profile) {
    throw new Error(`Profile not found after upsert: ${user.email}`);
  }

  if (created) counters.usersCreated++;
  else counters.usersReused++;

  return profile.id;
}

async function ensureMembershipPlan(
  service: SupabaseClient,
  boxId: string,
  planName: string
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
      precio: 999,
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
  today: string
): Promise<void> {
  const { data: existing, error: findErr } = await service
    .from("membresias")
    .select("id")
    .eq("usuario_id", usuarioId)
    .eq("plan_id", planId)
    .maybeSingle();

  if (findErr) throw new Error(`Membresia lookup: ${findErr.message}`);
  if (existing) return;

  const { error } = await service.from("membresias").insert({
    usuario_id: usuarioId,
    plan_id: planId,
    fecha_inicio: addDays(today, -7),
    fecha_fin: addDays(today, 30),
    estado: "vigente",
    metodo_asignacion: "automatico",
    notas: "QA demo seed",
  });

  if (error) throw new Error(`Membresia insert: ${error.message}`);
}

async function ensureAtletaPerfil(
  service: SupabaseClient,
  usuarioId: string,
  nivel: "beginner" | "intermediate" | "advanced" | "rx"
): Promise<void> {
  const { error } = await service.from("atleta_perfil_deportivo").upsert(
    {
      usuario_id: usuarioId,
      nivel_deportivo: nivel,
      disciplina: "CrossFit",
    },
    { onConflict: "usuario_id" }
  );
  if (error) throw new Error(`atleta_perfil_deportivo: ${error.message}`);
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
    cupo_maximo?: number;
  },
  counters: SeedCounters
): Promise<ClaseRow> {
  const { data: existing, error: findErr } = await service
    .from("clases")
    .select("id, fecha, nombre, cupo_maximo")
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
      cupo_maximo: params.cupo_maximo ?? 12,
      box_id: params.boxId,
      coach_id: params.coachId,
      estado: "programada",
      entrenamiento: getSampleWorkout(params.nombre),
    })
    .select("id, fecha, nombre, cupo_maximo")
    .single();

  if (error) throw new Error(`Clase ${params.nombre}: ${error.message}`);
  counters.clasesCreated++;
  return data as ClaseRow;
}

async function insertReservaQa(
  service: SupabaseClient,
  claseId: string,
  usuarioId: string,
  estado: "confirmada" | "asistio" | "no_asistio",
  counters: SeedCounters
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
        ? " Ejecuta supabase/patch-admin-insert-reserva.sql en Supabase."
        : "";
    throw new Error(`Reserva: ${error.message}${hint}`);
  }

  counters.reservasCreated++;
  return data.id as string;
}

async function seedBoxQaData(params: {
  service: SupabaseClient;
  box: BoxRow;
  classPrefix: string;
  planName: string;
  users: {
    admin: QaUserRow;
    coach: QaUserRow;
    socios: QaUserRow[];
  };
  today: string;
}): Promise<{
  counters: SeedCounters;
  coachId: string;
  socioIds: string[];
  clases: ClaseRow[];
}> {
  const counters = emptyCounters();
  const { service, box, classPrefix, planName, users, today } = params;

  await ensureQaUser(service, box.id, users.admin, counters);
  const coachId = await ensureQaUser(service, box.id, users.coach, counters);
  const socioIds: string[] = [];

  for (const socio of users.socios) {
    const id = await ensureQaUser(service, box.id, socio, counters);
    socioIds.push(id);
  }

  const planId = await ensureMembershipPlan(service, box.id, planName);
  for (const socioId of socioIds) {
    await ensureMembresia(service, socioId, planId, today);
  }

  const niveles: Array<"beginner" | "intermediate" | "advanced" | "rx"> = [
    "beginner",
    "intermediate",
    "advanced",
  ];
  for (let i = 0; i < socioIds.length; i++) {
    await ensureAtletaPerfil(service, socioIds[i], niveles[i % niveles.length]);
  }

  const classBases = ["Strength", "Conditioning", "Functional"];
  const suffixes = ["Alpha", "Beta", "Gamma"];
  const dates = dateRange(-7, 7, today);
  const clases: ClaseRow[] = [];

  for (let i = 0; i < dates.length; i++) {
    const fecha = dates[i];
    const base = classBases[i % classBases.length];
    const suffix = suffixes[i % suffixes.length];

    clases.push(
      await ensureClase(
        service,
        {
          boxId: box.id,
          coachId,
          nombre: `${classPrefix}${base} ${suffix}`,
          fecha,
          hora_inicio: "07:00",
          hora_fin: "08:00",
        },
        counters
      )
    );

    if (i % 2 === 0) {
      clases.push(
        await ensureClase(
          service,
          {
            boxId: box.id,
            coachId,
            nombre: `${classPrefix}${base} Evening`,
            fecha,
            hora_inicio: "18:00",
            hora_fin: "19:00",
          },
          counters
        )
      );
    } else if (i % 3 === 1) {
      clases.push(
        await ensureClase(
          service,
          {
            boxId: box.id,
            coachId,
            nombre: `${classPrefix}Functional Night`,
            fecha,
            hora_inicio: "20:00",
            hora_fin: "21:00",
          },
          counters
        )
      );
    }
  }

  const cupoClass = await ensureClase(
    service,
    {
      boxId: box.id,
      coachId,
      nombre: `${classPrefix}Cupo Lleno QA`,
      fecha: addDays(today, 2),
      hora_inicio: "18:00",
      hora_fin: "19:00",
      cupo_maximo: 2,
    },
    counters
  );
  clases.push(cupoClass);

  const uniqueClases = Array.from(
    new Map(clases.map((c) => [c.id, c])).values()
  ).sort((a, b) =>
    `${a.fecha}${a.nombre}`.localeCompare(`${b.fecha}${b.nombre}`)
  );

  for (let s = 0; s < socioIds.length; s++) {
    const picks = [
      uniqueClases[(s * 2) % uniqueClases.length],
      uniqueClases[(s * 2 + 1) % uniqueClases.length],
      uniqueClases[(s * 2 + 2) % uniqueClases.length],
    ];

    for (const clase of picks) {
      const estado = clase.fecha < today ? "asistio" : "confirmada";
      await insertReservaQa(service, clase.id, socioIds[s], estado, counters);
    }
  }

  await insertReservaQa(service, cupoClass.id, socioIds[0], "confirmada", counters);
  await insertReservaQa(service, cupoClass.id, socioIds[1], "confirmada", counters);

  return { counters, coachId, socioIds, clases: uniqueClases };
}

function printCredentialsTable(rows: Array<{
  box: string;
  rol: string;
  nombre: string;
  email: string;
}>) {
  console.log("\nCredenciales QA (solo consola — no se guardan en repo):\n");
  console.log("box | rol | nombre | email | password");
  console.log("--- | --- | ------ | ----- | --------");
  for (const row of rows) {
    console.log(
      `${row.box} | ${row.rol} | ${row.nombre} | ${row.email} | ${QA_PASSWORD}`
    );
  }
  console.log("");
}

async function main() {
  const { service } = requireQaScriptEnv();
  const today = todayInTimezone(TIMEZONE);

  console.log("🌱 ATHRON QA — seed demo boxes\n");

  const parabellum = await findParabellumBox(service);
  console.log(
    `Parabellum detectado: "${parabellum.name}" (${parabellum.slug}) id=${parabellum.id}`
  );

  const parabellumUsers = {
    admin: {
      email: PARABELLUM_EMAILS.admin,
      nombre: "QA Admin Parabellum",
      rol: "admin" as const,
    },
    coach: {
      email: PARABELLUM_EMAILS.coach,
      nombre: "QA Coach Parabellum",
      rol: "coach" as const,
    },
    socios: [
      {
        email: PARABELLUM_EMAILS.socio1,
        nombre: "QA Socio Parabellum 1",
        rol: "socio" as const,
      },
      {
        email: PARABELLUM_EMAILS.socio2,
        nombre: "QA Socio Parabellum 2",
        rol: "socio" as const,
      },
      {
        email: PARABELLUM_EMAILS.socio3,
        nombre: "QA Socio Parabellum 3",
        rol: "socio" as const,
      },
    ],
  };

  const parabellumSeed = await seedBoxQaData({
    service,
    box: parabellum,
    classPrefix: PARABELLUM_CLASS_PREFIX,
    planName: PARABELLUM_PLAN_NAME,
    users: parabellumUsers,
    today,
  });

  const { box: beta, created: betaCreated } = await ensureBetaBox(service);
  if (betaCreated) {
    console.log(`\nBeta creado: "${beta.name}" (${beta.slug}) id=${beta.id}`);
  } else {
    console.log(`\nBeta reutilizado: "${beta.name}" (${beta.slug}) id=${beta.id}`);
  }
  await ensureBoxSubscriptionPro(service, beta.id);

  const betaUsers = {
    admin: {
      email: BETA_EMAILS.admin,
      nombre: "QA Admin Beta",
      rol: "admin" as const,
    },
    coach: {
      email: BETA_EMAILS.coach,
      nombre: "QA Coach Beta",
      rol: "coach" as const,
    },
    socios: [
      {
        email: BETA_EMAILS.socio1,
        nombre: "QA Socio Beta 1",
        rol: "socio" as const,
      },
      {
        email: BETA_EMAILS.socio2,
        nombre: "QA Socio Beta 2",
        rol: "socio" as const,
      },
      {
        email: BETA_EMAILS.socio3,
        nombre: "QA Socio Beta 3",
        rol: "socio" as const,
      },
    ],
  };

  const betaSeed = await seedBoxQaData({
    service,
    box: beta,
    classPrefix: BETA_CLASS_PREFIX,
    planName: BETA_PLAN_NAME,
    users: betaUsers,
    today,
  });

  console.log("\n══════════════════════════════════════════");
  console.log("Resumen Parabellum Cross");
  console.log(`  nombre: ${parabellum.name}`);
  console.log(`  slug:   ${parabellum.slug}`);
  console.log(`  id:     ${parabellum.id}`);
  console.log(
    `  usuarios QA: ${parabellumSeed.counters.usersCreated} creados, ${parabellumSeed.counters.usersReused} reutilizados`
  );
  console.log(
    `  clases QA:   ${parabellumSeed.counters.clasesCreated} creadas, ${parabellumSeed.counters.clasesReused} reutilizadas (total ${parabellumSeed.clases.length})`
  );
  console.log(
    `  reservas QA: ${parabellumSeed.counters.reservasCreated} creadas, ${parabellumSeed.counters.reservasReused} reutilizadas`
  );

  console.log("\nResumen QA Demo Box Beta");
  console.log(`  nombre: ${beta.name}`);
  console.log(`  slug:   ${beta.slug}`);
  console.log(`  id:     ${beta.id}`);
  console.log(
    `  usuarios: ${betaSeed.counters.usersCreated} creados, ${betaSeed.counters.usersReused} reutilizados`
  );
  console.log(
    `  clases:   ${betaSeed.counters.clasesCreated} creadas, ${betaSeed.counters.clasesReused} reutilizadas (total ${betaSeed.clases.length})`
  );
  console.log(
    `  reservas: ${betaSeed.counters.reservasCreated} creadas, ${betaSeed.counters.reservasReused} reutilizadas`
  );
  console.log("══════════════════════════════════════════");

  printCredentialsTable([
    {
      box: "Parabellum",
      rol: "admin",
      nombre: parabellumUsers.admin.nombre,
      email: parabellumUsers.admin.email,
    },
    {
      box: "Parabellum",
      rol: "coach",
      nombre: parabellumUsers.coach.nombre,
      email: parabellumUsers.coach.email,
    },
    ...parabellumUsers.socios.map((s) => ({
      box: "Parabellum",
      rol: "socio",
      nombre: s.nombre,
      email: s.email,
    })),
    {
      box: "Beta",
      rol: "admin",
      nombre: betaUsers.admin.nombre,
      email: betaUsers.admin.email,
    },
    {
      box: "Beta",
      rol: "coach",
      nombre: betaUsers.coach.nombre,
      email: betaUsers.coach.email,
    },
    ...betaUsers.socios.map((s) => ({
      box: "Beta",
      rol: "socio",
      nombre: s.nombre,
      email: s.email,
    })),
  ]);

  console.log("✓ Seed QA completado.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
