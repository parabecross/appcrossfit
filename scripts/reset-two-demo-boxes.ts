/**
 * Reset permanente de 2 boxes demo multi-tenant:
 *   - parabellum-cross (Parabellum Cross · ATHRON Elite)
 *   - iron-district-box (Iron District Box · ATHRON Pro)
 *
 *   ATHRON_QA_CONFIRM=true npm run reset-two-demo-boxes
 *
 * Solo afecta esos dos slugs. Idempotente: borra datos dependientes y recrea dataset limpio.
 * NO toca: RLS, migraciones, Super Admin, otros boxes, box_subscriptions existentes (solo upsert).
 */

import { resolve } from "path";
import * as dotenv from "dotenv";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSampleWorkout } from "../src/lib/clases/sample-workouts";
import { PR_EXERCISES, SKILL_KEYS } from "../src/lib/progreso/constants";
import { backfillRankingForBox } from "../src/lib/ranking/engine";
import { createScriptSupabaseClient } from "./lib/supabase-script-client";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const ALLOWED_SLUGS = ["parabellum-cross", "iron-district-box"] as const;
const DEMO_PASSWORD = "Athron2026!";
const TIMEZONE = "America/Mexico_City";
const QA_ABORT =
  "Abortado: define ATHRON_QA_CONFIRM=true para resetear los boxes demo.";

type AllowedSlug = (typeof ALLOWED_SLUGS)[number];
type BoxRow = { id: string; name: string; slug: string };
type DemoRole = "admin" | "coach" | "socio";

type DemoUserDef = {
  email: string;
  nombre: string;
  rol: DemoRole;
};

type BoxDemoConfig = {
  slug: AllowedSlug;
  name: string;
  saasPlanCode: "elite" | "pro";
  emailPrefix: string;
  classNames: [string, string, string, string];
  adminNombre: string;
  coachNombres: [string, string];
  socioNombres: string[];
};

const PARABELLUM_CONFIG: BoxDemoConfig = {
  slug: "parabellum-cross",
  name: "Parabellum Cross",
  saasPlanCode: "elite",
  emailPrefix: "parabellum",
  classNames: [
    "Fuerza Parabellum",
    "Conditioning Parabellum",
    "Functional Parabellum",
    "Mobility Parabellum",
  ],
  adminNombre: "Roberto Mendoza",
  coachNombres: ["Alejandro Vega", "Daniela Ruiz"],
  socioNombres: [
    "Lucía Herrera",
    "Sofía López",
    "Miguel Ramos",
    "Valentina Castro",
    "Diego Morales",
    "Camila Ríos",
    "Fernando Aguilar",
    "Mariana Soto",
    "Javier Pineda",
    "Paola Núñez",
    "Ricardo Delgado",
    "Andrea Fuentes",
  ],
};

const IRON_CONFIG: BoxDemoConfig = {
  slug: "iron-district-box",
  name: "Iron District Box",
  saasPlanCode: "pro",
  emailPrefix: "iron",
  classNames: [
    "Strength Iron",
    "Conditioning Iron",
    "Engine Iron",
    "Mobility Iron",
  ],
  adminNombre: "Carolina Navarro",
  coachNombres: ["Miguel Torres", "Laura Herrera"],
  socioNombres: [
    "Emilio Vargas",
    "Gabriela Ortiz",
    "Héctor Salinas",
    "Isabel Camacho",
    "Jorge Mejía",
    "Karina Espinoza",
    "Leonardo Cruz",
    "Montserrat León",
    "Nicolás Ibáñez",
    "Olivia Reyna",
    "Pablo Zúñiga",
    "Renata Guzmán",
  ],
};

const BOX_CONFIGS = [PARABELLUM_CONFIG, IRON_CONFIG] as const;

const MEMBERSHIP_PLANS = [
  { nombre: "Ilimitado", duracion_dias: 30, precio: 1899 },
  { nombre: "12 clases", duracion_dias: 30, precio: 1499 },
  { nombre: "8 clases", duracion_dias: 30, precio: 1199 },
] as const;

const CLASS_SLOTS = [
  { hora_inicio: "07:00", hora_fin: "08:00" },
  { hora_inicio: "09:00", hora_fin: "10:00" },
  { hora_inicio: "18:00", hora_fin: "19:00" },
  { hora_inicio: "20:00", hora_fin: "21:00" },
] as const;

const CUPO_OPTIONS = [8, 10, 12] as const;

type ClaseRow = {
  id: string;
  fecha: string;
  nombre: string;
  cupo_maximo: number;
  hora_inicio: string;
};

type BoxSeedResult = {
  box: BoxRow;
  saasPlanLabel: string;
  users: DemoUserDef[];
  profileIds: string[];
  claseCount: number;
  reservaCount: number;
  membresiaCount: number;
};

function requireScriptEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const confirmed = process.env.ATHRON_QA_CONFIRM === "true";

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!serviceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length > 0) {
    console.error(`Abortado: faltan variables en .env.local: ${missing.join(", ")}`);
    process.exit(1);
  }

  if (!confirmed) {
    console.error(QA_ABORT);
    process.exit(1);
  }

  return createScriptSupabaseClient(url!, serviceKey!);
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

function buildUsers(config: BoxDemoConfig): DemoUserDef[] {
  const prefix = config.emailPrefix;
  const users: DemoUserDef[] = [
    {
      email: `${prefix}.admin@athron.test`,
      nombre: config.adminNombre,
      rol: "admin",
    },
    {
      email: `${prefix}.coach1@athron.test`,
      nombre: config.coachNombres[0],
      rol: "coach",
    },
    {
      email: `${prefix}.coach2@athron.test`,
      nombre: config.coachNombres[1],
      rol: "coach",
    },
  ];

  config.socioNombres.forEach((nombre, i) => {
    users.push({
      email: `${prefix}.socio${i + 1}@athron.test`,
      nombre,
      rol: "socio",
    });
  });

  return users;
}

async function countForBox(
  service: SupabaseClient,
  table: string,
  boxId: string,
  column = "box_id"
): Promise<number> {
  const { count, error } = await service
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, boxId);

  if (error) {
    if (error.message.includes("does not exist")) return 0;
    throw new Error(`${table} count: ${error.message}`);
  }
  return count ?? 0;
}

async function countProfilesForBox(
  service: SupabaseClient,
  boxId: string
): Promise<number> {
  const { count, error } = await service
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("box_id", boxId);

  if (error) throw new Error(`profiles count: ${error.message}`);
  return count ?? 0;
}

async function countMembresiasForBox(
  service: SupabaseClient,
  boxId: string
): Promise<number> {
  const { data: profiles, error: pErr } = await service
    .from("profiles")
    .select("id")
    .eq("box_id", boxId);

  if (pErr) throw new Error(`profiles for membresias: ${pErr.message}`);
  const ids = (profiles ?? []).map((p) => p.id);
  if (ids.length === 0) return 0;

  const { count, error } = await service
    .from("membresias")
    .select("*", { count: "exact", head: true })
    .in("usuario_id", ids);

  if (error) throw new Error(`membresias count: ${error.message}`);
  return count ?? 0;
}

async function countReservasForBox(
  service: SupabaseClient,
  boxId: string
): Promise<number> {
  const { data: clases, error: cErr } = await service
    .from("clases")
    .select("id")
    .eq("box_id", boxId);

  if (cErr) throw new Error(`clases for reservas count: ${cErr.message}`);
  const claseIds = (clases ?? []).map((c) => c.id);
  if (claseIds.length === 0) return 0;

  const { count, error } = await service
    .from("reservas")
    .select("*", { count: "exact", head: true })
    .in("clase_id", claseIds);

  if (error) throw new Error(`reservas count: ${error.message}`);
  return count ?? 0;
}

async function printBoxSnapshot(
  service: SupabaseClient,
  box: BoxRow,
  existedBefore: boolean
): Promise<void> {
  if (!existedBefore) {
    console.log(`  Box nuevo creado: ${box.name} (${box.slug}) id=${box.id}`);
    return;
  }

  const [usuarios, clases, reservas, membresias] = await Promise.all([
    countProfilesForBox(service, box.id),
    countForBox(service, "clases", box.id),
    countReservasForBox(service, box.id),
    countMembresiasForBox(service, box.id),
  ]);

  console.log(`  Box existente: ${box.name}`);
  console.log(`    slug:        ${box.slug}`);
  console.log(`    id:          ${box.id}`);
  console.log(`    usuarios:    ${usuarios}`);
  console.log(`    clases:      ${clases}`);
  console.log(`    reservas:    ${reservas}`);
  console.log(`    membresías:  ${membresias}`);
}

async function ensureBox(
  service: SupabaseClient,
  config: BoxDemoConfig
): Promise<{ box: BoxRow; created: boolean }> {
  if (!ALLOWED_SLUGS.includes(config.slug)) {
    throw new Error(`Slug no permitido: ${config.slug}`);
  }

  const { data: existing, error: findErr } = await service
    .from("boxes")
    .select("id, name, slug")
    .eq("slug", config.slug)
    .maybeSingle();

  if (findErr) throw new Error(`Box lookup ${config.slug}: ${findErr.message}`);
  if (existing) return { box: existing, created: false };

  const { data, error } = await service
    .from("boxes")
    .insert({
      name: config.name,
      slug: config.slug,
      status: "active",
      plan: "free",
      timezone: TIMEZONE,
    })
    .select("id, name, slug")
    .single();

  if (error) throw new Error(`Box create ${config.slug}: ${error.message}`);
  return { box: data, created: true };
}

async function deleteIn(
  service: SupabaseClient,
  table: string,
  column: string,
  ids: string[]
): Promise<number> {
  if (ids.length === 0) return 0;
  const { data, error } = await service.from(table).delete().in(column, ids).select("id");
  if (error) {
    if (error.message.includes("does not exist")) return 0;
    throw new Error(`${table} delete: ${error.message}`);
  }
  return data?.length ?? 0;
}

async function deleteByBoxId(
  service: SupabaseClient,
  table: string,
  boxId: string
): Promise<number> {
  const { data, error } = await service
    .from(table)
    .delete()
    .eq("box_id", boxId)
    .select("id");

  if (error) {
    if (error.message.includes("does not exist")) return 0;
    throw new Error(`${table} delete: ${error.message}`);
  }
  return data?.length ?? 0;
}

function isMissingOptionalTable(error: { message?: string; code?: string }): boolean {
  const msg = error.message ?? "";
  return (
    error.code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("Could not find the table") ||
    msg.includes("schema cache")
  );
}

async function deleteOptionalByBoxId(
  service: SupabaseClient,
  table: string,
  boxId: string
): Promise<void> {
  const { error } = await service.from(table).delete().eq("box_id", boxId);
  if (error && !isMissingOptionalTable(error)) {
    throw new Error(`${table}: ${error.message}`);
  }
}

function formatAuthError(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);
  const e = error as { message?: string; status?: number; code?: string };
  const parts = [e.message, e.code, e.status != null ? `status ${e.status}` : null].filter(
    Boolean
  );
  return parts.length > 0 ? parts.join(" · ") : JSON.stringify(error);
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

async function deleteBoxDependentData(
  service: SupabaseClient,
  boxId: string
): Promise<void> {
  const { data: profiles, error: pErr } = await service
    .from("profiles")
    .select("id, user_id, is_super_admin")
    .eq("box_id", boxId);

  if (pErr) throw new Error(`profiles lookup: ${pErr.message}`);

  const removable = (profiles ?? []).filter((p) => !p.is_super_admin);
  const profileIds = removable.map((p) => p.id);
  const userIds = removable.map((p) => p.user_id);

  const { data: clases, error: cErr } = await service
    .from("clases")
    .select("id")
    .eq("box_id", boxId);

  if (cErr) throw new Error(`clases lookup: ${cErr.message}`);
  const claseIds = (clases ?? []).map((c) => c.id);

  await deleteByBoxId(service, "ranking_point_events", boxId);
  await deleteByBoxId(service, "ranking_monthly_awards", boxId);

  if (claseIds.length > 0) {
    await deleteIn(service, "clase_scores", "clase_id", claseIds);
  }
  if (profileIds.length > 0) {
    await deleteIn(service, "clase_scores", "usuario_id", profileIds);
  }

  if (claseIds.length > 0) {
    await deleteIn(service, "reservas", "clase_id", claseIds);
  }
  if (profileIds.length > 0) {
    await deleteIn(service, "reservas", "usuario_id", profileIds);
  }

  if (profileIds.length > 0) {
    const atletaTables = [
      "atleta_skill_historial",
      "atleta_skills",
      "atleta_pr_marcas",
      "atleta_objetivos",
      "atleta_perfil_deportivo",
      "membresias",
    ] as const;

    for (const table of atletaTables) {
      const selectCol =
        table === "atleta_perfil_deportivo" ? "usuario_id" : "id";
      const { data, error } = await service
        .from(table)
        .delete()
        .in("usuario_id", profileIds)
        .select(selectCol);

      if (error && !isMissingOptionalTable(error)) {
        throw new Error(`${table}: ${error.message}`);
      }
      void data;
    }
  }

  if (claseIds.length > 0) {
    await deleteIn(service, "clases", "id", claseIds);
  }

  await service.from("planes").delete().eq("box_id", boxId);

  // owner_user_id referencia auth.users y bloquea deleteUser si no se limpia antes
  const { error: ownerErr } = await service
    .from("boxes")
    .update({ owner_user_id: null })
    .eq("id", boxId);
  if (ownerErr) throw new Error(`boxes owner clear: ${ownerErr.message}`);

  await deleteOptionalByBoxId(service, "audit_log", boxId);

  if (profileIds.length > 0) {
    const { error: profErr } = await service
      .from("profiles")
      .delete()
      .in("id", profileIds);
    if (profErr) throw new Error(`profiles delete: ${profErr.message}`);
  }

  for (const userId of userIds) {
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) {
      console.warn(`  ⚠ auth user no borrado ${userId}: ${formatAuthError(error)}`);
    }
  }
}

async function ensureSaasSubscription(
  service: SupabaseClient,
  boxId: string,
  planCode: "elite" | "pro"
): Promise<string> {
  const { data: saasPlan, error: planErr } = await service
    .from("plans")
    .select("id, name, code")
    .eq("code", planCode)
    .single();

  if (planErr || !saasPlan) {
    throw new Error(
      `No se encontró plan SaaS code=${planCode}. Ejecuta migration-athron-plans-v1.sql.`
    );
  }

  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30);

  const { error } = await service.from("box_subscriptions").upsert(
    {
      box_id: boxId,
      plan_id: saasPlan.id,
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

  return saasPlan.name ?? planCode.toUpperCase();
}

type CreatedDemoUser = { profileId: string; authUserId: string };

async function createDemoUser(
  service: SupabaseClient,
  boxId: string,
  user: DemoUserDef
): Promise<CreatedDemoUser> {
  const authByEmail = await listAuthUsersByEmail(service);
  let authUserId = authByEmail.get(user.email.toLowerCase());

  if (!authUserId) {
    const { data, error } = await service.auth.admin.createUser({
      email: user.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        nombre_completo: user.nombre,
        rol: user.rol,
        box_id: boxId,
      },
    });
    if (error) throw new Error(`User ${user.email}: ${error.message}`);
    authUserId = data.user!.id;
  } else {
    const { error: updateErr } = await service.auth.admin.updateUserById(authUserId, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        nombre_completo: user.nombre,
        rol: user.rol,
        box_id: boxId,
      },
    });
    if (updateErr) {
      throw new Error(`User update ${user.email}: ${formatAuthError(updateErr)}`);
    }
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

  if (profileErr) throw new Error(`Profile ${user.email}: ${profileErr.message}`);

  const { data: profile, error: fetchErr } = await service
    .from("profiles")
    .select("id")
    .eq("user_id", authUserId)
    .single();

  if (fetchErr || !profile) {
    throw new Error(`Profile missing after create: ${user.email}`);
  }

  return { profileId: profile.id, authUserId };
}

async function insertReserva(
  service: SupabaseClient,
  claseId: string,
  usuarioId: string,
  estado: "confirmada" | "asistio" | "no_asistio" | "cancelada"
): Promise<string> {
  const { data: rpcId, error: rpcErr } = await service.rpc("admin_insert_reserva", {
    p_clase_id: claseId,
    p_usuario_id: usuarioId,
    p_estado: estado,
  });

  if (!rpcErr && rpcId) return rpcId as string;

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

  return data.id as string;
}

async function insertScore(
  service: SupabaseClient,
  claseId: string,
  usuarioId: string,
  reservaId: string,
  display: string
): Promise<void> {
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

async function seedBox(
  service: SupabaseClient,
  config: BoxDemoConfig,
  today: string
): Promise<BoxSeedResult> {
  const { box, created } = await ensureBox(service, config);
  console.log(`\n▶ ${config.name} (${config.slug})`);
  await printBoxSnapshot(service, box, !created);

  console.log("  Borrando datos dependientes del box…");
  await deleteBoxDependentData(service, box.id);

  const saasPlanLabel = await ensureSaasSubscription(
    service,
    box.id,
    config.saasPlanCode
  );

  const users = buildUsers(config);
  const userIdByEmail = new Map<string, string>();
  const coachIds: string[] = [];
  const socioIds: string[] = [];
  let adminAuthUserId: string | null = null;

  for (const user of users) {
    const created = await createDemoUser(service, box.id, user);
    userIdByEmail.set(user.email, created.profileId);
    if (user.rol === "admin") adminAuthUserId = created.authUserId;
    if (user.rol === "coach") coachIds.push(created.profileId);
    if (user.rol === "socio") socioIds.push(created.profileId);
  }

  if (adminAuthUserId) {
    const { error: ownerSetErr } = await service
      .from("boxes")
      .update({ owner_user_id: adminAuthUserId })
      .eq("id", box.id);
    if (ownerSetErr) {
      console.warn(`  ⚠ owner_user_id no actualizado: ${ownerSetErr.message}`);
    }
  }

  const planIds: string[] = [];
  for (const plan of MEMBERSHIP_PLANS) {
    const { data, error } = await service
      .from("planes")
      .insert({
        nombre: plan.nombre,
        tipo: "mensual_fijo",
        duracion_dias: plan.duracion_dias,
        precio: plan.precio,
        activo: true,
        box_id: box.id,
      })
      .select("id")
      .single();

    if (error) throw new Error(`Plan ${plan.nombre}: ${error.message}`);
    planIds.push(data.id);
  }

  const membresiaProfiles: Array<{
    socioId: string;
    planId: string;
    fecha_inicio: string;
    fecha_fin: string;
    estado: "vigente" | "vencida";
  }> = [];

  socioIds.forEach((socioId, i) => {
    const planId = planIds[i % planIds.length];
    if (i < 8) {
      membresiaProfiles.push({
        socioId,
        planId,
        fecha_inicio: addDays(today, -10),
        fecha_fin: addDays(today, 25),
        estado: "vigente",
      });
    } else if (i < 10) {
      membresiaProfiles.push({
        socioId,
        planId,
        fecha_inicio: addDays(today, -20),
        fecha_fin: addDays(today, 3 + (i - 8)),
        estado: "vigente",
      });
    } else if (i === 10) {
      membresiaProfiles.push({
        socioId,
        planId,
        fecha_inicio: addDays(today, -45),
        fecha_fin: addDays(today, -5),
        estado: "vencida",
      });
    } else {
      membresiaProfiles.push({
        socioId,
        planId,
        fecha_inicio: addDays(today, -2),
        fecha_fin: addDays(today, 28),
        estado: "vigente",
      });
    }
  });

  for (const m of membresiaProfiles) {
    const { error } = await service.from("membresias").insert({
      usuario_id: m.socioId,
      plan_id: m.planId,
      fecha_inicio: m.fecha_inicio,
      fecha_fin: m.fecha_fin,
      estado: m.estado,
      metodo_asignacion: "manual",
      notas: "Demo reset-two-demo-boxes",
    });
    if (error) throw new Error(`Membresia: ${error.message}`);
  }

  const niveles: Array<"beginner" | "intermediate" | "advanced" | "rx"> = [
    "beginner",
    "intermediate",
    "advanced",
    "rx",
  ];

  for (let i = 0; i < socioIds.length; i++) {
    const { error } = await service.from("atleta_perfil_deportivo").upsert(
      {
        usuario_id: socioIds[i],
        nivel_deportivo: niveles[i % niveles.length],
        disciplina: "CrossFit",
      },
      { onConflict: "usuario_id" }
    );
    if (error && !error.message.includes("does not exist")) {
      throw new Error(`atleta_perfil_deportivo: ${error.message}`);
    }
  }

  const dates: string[] = [];
  for (let offset = -7; offset <= 7; offset++) {
    dates.push(addDays(today, offset));
  }

  const clases: ClaseRow[] = [];
  let slotIndex = 0;
  let cupoClass: ClaseRow | null = null;

  for (let dayIdx = 0; dayIdx < dates.length; dayIdx++) {
    const fecha = dates[dayIdx];
    const coachId = coachIds[dayIdx % coachIds.length];

    for (let slotNum = 0; slotNum < 2; slotNum++) {
      const slot = CLASS_SLOTS[(slotIndex + slotNum) % CLASS_SLOTS.length];
      slotIndex++;
      const className = config.classNames[(dayIdx + slotNum) % config.classNames.length];
      const cupo =
        dayIdx === dates.length - 3 && slotNum === 1
          ? 2
          : CUPO_OPTIONS[(dayIdx + slotNum) % CUPO_OPTIONS.length];

      const { data, error } = await service
        .from("clases")
        .insert({
          nombre: className,
          fecha,
          hora_inicio: slot.hora_inicio,
          hora_fin: slot.hora_fin,
          cupo_maximo: cupo,
          box_id: box.id,
          coach_id: coachId,
          estado: "programada",
          entrenamiento: getSampleWorkout(className),
        })
        .select("id, fecha, nombre, cupo_maximo, hora_inicio")
        .single();

      if (error) throw new Error(`Clase ${className} ${fecha}: ${error.message}`);
      const row = data as ClaseRow;
      clases.push(row);
      if (cupo === 2) cupoClass = row;
    }
  }

  let reservaCount = 0;
  const reservaRecords: Array<{
    id: string;
    clase_id: string;
    usuario_id: string;
    estado: string;
    fecha: string;
  }> = [];

  for (let s = 0; s < socioIds.length; s++) {
    const numReservas = 2 + (s % 3);
    const picks = clases.filter((_, idx) => (idx + s) % 5 === 0).slice(0, numReservas);
    const fallback = clases.slice(s, s + numReservas);
    const selected = picks.length >= numReservas ? picks : fallback;

    for (let r = 0; r < selected.length; r++) {
      const clase = selected[r];
      const isPast = clase.fecha < today;
      let estado: "confirmada" | "asistio" | "cancelada";

      if (!isPast) {
        estado = "confirmada";
      } else if ((s + r) % 5 === 0) {
        estado = "cancelada";
      } else {
        estado = "asistio";
      }

      const reservaId = await insertReserva(
        service,
        clase.id,
        socioIds[s],
        estado
      );
      reservaCount++;
      reservaRecords.push({
        id: reservaId,
        clase_id: clase.id,
        usuario_id: socioIds[s],
        estado,
        fecha: clase.fecha,
      });
    }
  }

  if (cupoClass) {
    await insertReserva(service, cupoClass.id, socioIds[0], "confirmada");
    await insertReserva(service, cupoClass.id, socioIds[1], "confirmada");
    reservaCount += 2;
  }

  for (const rec of reservaRecords) {
    if (rec.estado !== "asistio" || rec.fecha >= today) continue;
    await insertScore(
      service,
      rec.clase_id,
      rec.usuario_id,
      rec.id,
      String(80 + (rec.id.charCodeAt(0) % 40))
    );
  }

  const prPool = PR_EXERCISES.slice(0, 6);
  for (let i = 0; i < socioIds.length; i++) {
    const uid = socioIds[i];
    await service.from("atleta_pr_marcas").insert({
      usuario_id: uid,
      ejercicio: prPool[i % prPool.length].key,
      record_tipo: "pr",
      valor: 135 + i * 5,
      unidad: prPool[i % prPool.length].unit,
      fecha: addDays(today, -14 + i),
    });

    if (i % 2 === 0) {
      await service.from("atleta_pr_marcas").insert({
        usuario_id: uid,
        ejercicio: prPool[(i + 1) % prPool.length].key,
        record_tipo: "rm",
        valor: 155 + i * 5,
        unidad: prPool[(i + 1) % prPool.length].unit,
        fecha: addDays(today, -7 + i),
      });
    }

    await service.from("atleta_skills").insert({
      usuario_id: uid,
      skill: SKILL_KEYS[i % SKILL_KEYS.length],
      estado: i % 3 === 0 ? "dominado" : i % 2 === 0 ? "logrado" : "en_proceso",
    });

    if (i % 3 === 0) {
      await service.from("atleta_skills").insert({
        usuario_id: uid,
        skill: SKILL_KEYS[(i + 2) % SKILL_KEYS.length],
        estado: "en_proceso",
      });
    }
  }

  try {
    const ledger = await backfillRankingForBox(
      box.id,
      service as Parameters<typeof backfillRankingForBox>[1]
    );
    console.log(
      `  Ranking ledger: ${ledger.attendance} asistencias · ${ledger.wod} WODs`
    );
  } catch (e) {
    console.warn("  ⚠ Ranking ledger no generado (¿patch-ranking-athron-v1.sql?)");
    console.warn(e);
  }

  return {
    box,
    saasPlanLabel,
    users,
    profileIds: [...coachIds, ...socioIds, ...Array.from(userIdByEmail.values())],
    claseCount: clases.length,
    reservaCount,
    membresiaCount: membresiaProfiles.length,
  };
}

function printCredentialsTable(
  rows: Array<{ box: string; rol: string; nombre: string; email: string }>
) {
  console.log("\nCredenciales demo (solo consola):\n");
  console.log("box | rol | nombre | email | password");
  console.log("--- | --- | ------ | ----- | --------");
  for (const row of rows) {
    console.log(
      `${row.box} | ${row.rol} | ${row.nombre} | ${row.email} | ${DEMO_PASSWORD}`
    );
  }
  console.log("");
}

async function main() {
  const service = requireScriptEnv();
  const today = todayInTimezone(TIMEZONE);

  console.log("🔄 ATHRON — reset two demo boxes");
  console.log(`   Slugs permitidos: ${ALLOWED_SLUGS.join(", ")}`);
  console.log(`   Fecha referencia (${TIMEZONE}): ${today}\n`);

  const results: BoxSeedResult[] = [];

  for (const config of BOX_CONFIGS) {
    if (!ALLOWED_SLUGS.includes(config.slug)) {
      console.error(`Abortado: slug fuera de lista permitida: ${config.slug}`);
      process.exit(1);
    }
    results.push(await seedBox(service, config, today));
  }

  printCredentialsTable(
    results.flatMap((r) =>
      r.users.map((u) => ({
        box: r.box.name,
        rol: u.rol,
        nombre: u.nombre,
        email: u.email,
      }))
    )
  );

  console.log("══════════════════════════════════════════");
  console.log("Resumen final");
  console.log("══════════════════════════════════════════");

  for (const r of results) {
    console.log(`\n${r.box.name} (${r.box.slug})`);
    console.log(`  box_id:       ${r.box.id}`);
    console.log(`  plan SaaS:    ${r.saasPlanLabel}`);
    console.log(`  usuarios:     ${r.users.length}`);
    console.log(`  clases:       ${r.claseCount}`);
    console.log(`  reservas:     ${r.reservaCount}`);
    console.log(`  membresías:   ${r.membresiaCount}`);
  }

  console.log("\n✓ Reset demo completado.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
