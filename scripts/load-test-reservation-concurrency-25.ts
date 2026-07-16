/**
 * Concurrencia de reservas sobre el box load-test-25.
 * Usa el mismo mecanismo que la API: INSERT en reservas (trigger check_reserva_cupo).
 *
 *   ATHRON_LOAD_TEST_CONFIRM=true npm run loadtest:25:concurrency
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSampleWorkout } from "../src/lib/clases/sample-workouts";
import { ACTIVE_RESERVA_ESTADOS } from "../src/lib/reservas/helpers";
import {
  LOAD_TEST_CONCURRENCY_CLASS,
  LOAD_TEST_SLUG,
  LOAD_TEST_TARGET_ATHLETES,
  LOAD_TEST_TIMEZONE,
  athleteEmail,
} from "./lib/load-test-25-constants";
import {
  addDays,
  listAuthUsersByEmail,
  requireLoadTestBox,
  requireLoadTestEnv,
  todayInTimezone,
} from "./lib/load-test-25-env";

type Check = { label: string; pass: boolean; detail: string };
const checks: Check[] = [];

function add(label: string, pass: boolean, detail: string) {
  checks.push({ label, pass, detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${label} — ${detail}`);
}

async function socioProfileIds(
  service: SupabaseClient,
  boxId: string
): Promise<string[]> {
  const auth = await listAuthUsersByEmail(service);
  const ids: string[] = [];
  for (let i = 1; i <= LOAD_TEST_TARGET_ATHLETES; i++) {
    const email = athleteEmail(i);
    const authId = auth.get(email.toLowerCase());
    if (!authId) throw new Error(`Falta auth user ${email}`);
    const { data, error } = await service
      .from("profiles")
      .select("id, box_id, rol")
      .eq("user_id", authId)
      .single();
    if (error || !data) throw new Error(`Profile ${email}: ${error?.message}`);
    if (data.box_id !== boxId || data.rol !== "socio") {
      throw new Error(`Profile ${email} no es socio del box load-test`);
    }
    ids.push(data.id);
  }
  return ids;
}

async function ensureConcurrencyClass(
  service: SupabaseClient,
  boxId: string,
  coachId: string
): Promise<{ id: string; cupo_maximo: number }> {
  const today = todayInTimezone(LOAD_TEST_TIMEZONE);
  const fecha = addDays(today, 4);

  const { data: existing } = await service
    .from("clases")
    .select("id, cupo_maximo")
    .eq("box_id", boxId)
    .eq("nombre", LOAD_TEST_CONCURRENCY_CLASS)
    .eq("fecha", fecha)
    .eq("hora_inicio", "12:00")
    .maybeSingle();

  if (existing) {
    await service
      .from("clases")
      .update({ cupo_maximo: 10, estado: "programada" })
      .eq("id", existing.id);
    return { id: existing.id, cupo_maximo: 10 };
  }

  // Reuse any existing concurrency class name regardless of date
  const { data: byName } = await service
    .from("clases")
    .select("id, cupo_maximo")
    .eq("box_id", boxId)
    .eq("nombre", LOAD_TEST_CONCURRENCY_CLASS)
    .limit(1)
    .maybeSingle();

  if (byName) {
    await service
      .from("clases")
      .update({ cupo_maximo: 10, estado: "programada", fecha })
      .eq("id", byName.id);
    return { id: byName.id, cupo_maximo: 10 };
  }

  const { data, error } = await service
    .from("clases")
    .insert({
      nombre: LOAD_TEST_CONCURRENCY_CLASS,
      fecha,
      hora_inicio: "12:00",
      hora_fin: "13:00",
      cupo_maximo: 10,
      box_id: boxId,
      coach_id: coachId,
      estado: "programada",
      entrenamiento: getSampleWorkout("Concurrency"),
    })
    .select("id, cupo_maximo")
    .single();

  if (error) throw new Error(`Concurrency class: ${error.message}`);
  return data;
}

async function clearReservasForClase(
  service: SupabaseClient,
  claseId: string
): Promise<void> {
  const { error } = await service.from("reservas").delete().eq("clase_id", claseId);
  if (error) throw new Error(`clear reservas: ${error.message}`);
}

async function countActive(
  service: SupabaseClient,
  claseId: string
): Promise<{ total: number; byUser: Map<string, number> }> {
  const { data, error } = await service
    .from("reservas")
    .select("id, usuario_id, estado")
    .eq("clase_id", claseId)
    .in("estado", [...ACTIVE_RESERVA_ESTADOS]);
  if (error) throw error;
  const byUser = new Map<string, number>();
  for (const r of data ?? []) {
    byUser.set(r.usuario_id, (byUser.get(r.usuario_id) ?? 0) + 1);
  }
  return { total: data?.length ?? 0, byUser };
}

/** Mismo path que API /api/reservas (service-role INSERT → trigger cupo). */
async function attemptReserve(
  service: SupabaseClient,
  claseId: string,
  usuarioId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: existing } = await service
    .from("reservas")
    .select("id")
    .eq("clase_id", claseId)
    .eq("usuario_id", usuarioId)
    .in("estado", [...ACTIVE_RESERVA_ESTADOS])
    .maybeSingle();

  if (existing) return { ok: true };

  const { error } = await service.from("reservas").insert({
    clase_id: claseId,
    usuario_id: usuarioId,
    estado: "confirmada",
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function main() {
  const { service } = requireLoadTestEnv();
  const box = await requireLoadTestBox(service);

  if (box.slug !== LOAD_TEST_SLUG) {
    console.error("FAIL — slug incorrecto");
    process.exit(1);
  }

  console.log(`ATHRON load-test-25 — concurrency (${box.id})\n`);

  const socioIds = await socioProfileIds(service, box.id);
  const { data: coach } = await service
    .from("profiles")
    .select("id")
    .eq("box_id", box.id)
    .eq("rol", "coach")
    .limit(1)
    .maybeSingle();
  if (!coach) throw new Error("Falta coach en box load-test");

  // ── Escenario 1: 20 concurrentes / cupo 10 ──────────────────────────────
  const clase = await ensureConcurrencyClass(service, box.id, coach.id);
  await clearReservasForClase(service, clase.id);

  const contenders = socioIds.slice(0, 20);
  const results = await Promise.all(
    contenders.map((uid) => attemptReserve(service, clase.id, uid))
  );

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;
  const after1 = await countActive(service, clase.id);

  add(
    "escenario1 exactamente 10 activas",
    after1.total === 10,
    `activas=${after1.total} inserts_ok=${okCount} rejected=${failCount}`
  );
  add(
    "escenario1 0 sobrecupo",
    after1.total <= 10,
    `activas=${after1.total} cupo=10`
  );
  add(
    "escenario1 0 duplicados",
    [...after1.byUser.values()].every((n) => n === 1),
    `users=${after1.byUser.size}`
  );
  add(
    "escenario1 rechazos controlados",
    failCount >= 10 && after1.total === 10,
    `rejected=${failCount}`
  );

  // ── Escenario 2: mismo atleta concurrente ───────────────────────────────
  await clearReservasForClase(service, clase.id);
  const sameAthlete = socioIds[0];
  const dupResults = await Promise.all(
    Array.from({ length: 8 }, () =>
      attemptReserve(service, clase.id, sameAthlete)
    )
  );
  const after2 = await countActive(service, clase.id);
  const sameCount = after2.byUser.get(sameAthlete) ?? 0;

  add(
    "escenario2 una sola reserva activa",
    after2.total === 1 && sameCount === 1,
    `activas=${after2.total} same=${sameCount} ok=${dupResults.filter((r) => r.ok).length}`
  );

  // ── Escenario 3: cancelar + nueva reserva ───────────────────────────────
  await clearReservasForClase(service, clase.id);
  const fill = socioIds.slice(0, 10);
  await Promise.all(fill.map((uid) => attemptReserve(service, clase.id, uid)));
  const beforeCancel = await countActive(service, clase.id);

  const cancelTarget = fill[0];
  const { data: toCancel } = await service
    .from("reservas")
    .select("id")
    .eq("clase_id", clase.id)
    .eq("usuario_id", cancelTarget)
    .in("estado", [...ACTIVE_RESERVA_ESTADOS])
    .maybeSingle();

  if (!toCancel) throw new Error("No hay reserva para cancelar");

  const { error: cancelErr } = await service
    .from("reservas")
    .update({ estado: "cancelada" })
    .eq("id", toCancel.id);
  if (cancelErr) throw new Error(cancelErr.message);

  const newAthlete = socioIds[15];
  const rebook = await attemptReserve(service, clase.id, newAthlete);
  const after3 = await countActive(service, clase.id);

  add(
    "escenario3 cupo tras cancel+reserve",
    beforeCancel.total === 10 && after3.total === 10 && rebook.ok,
    `before=${beforeCancel.total} after=${after3.total} rebook=${rebook.ok}`
  );
  add(
    "escenario3 0 sobrecupo final",
    after3.total <= 10,
    `activas=${after3.total}`
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(
    `\nResumen: ${checks.length - failed.length}/${checks.length} checks OK`
  );

  if (failed.length > 0) {
    console.error("\nFAIL — concurrency load-test-25");
    process.exit(1);
  }

  console.log("\nPASS — concurrency load-test-25");
}

main().catch((err) => {
  console.error("\nFAIL —", err);
  process.exit(1);
});
