/**
 * Teardown exclusivo del escenario Parabellum-10-QA.
 *
 *   ATHRON_PARABELLUM_QA_CONFIRM=true npm run qa:parabellum10:teardown
 *
 * No borra el box, planes reales, coaches ni atletas reales.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PARABELLUM_BOX_ID,
  QA_CLASS_PREFIX,
  QA_EMAIL_PREFIX,
  allQaEmails,
  assertQaEmail,
  isQaEmail,
} from "./lib/parabellum-10-qa-constants";
import {
  assertOnlyQaEmails,
  countSocios,
  listAuthUsersByEmail,
  loadSnapshot,
  loadSubscriptionSnapshot,
  requireParabellumQaEnv,
  resolveParabellumBox,
} from "./lib/parabellum-10-qa-env";

type Counts = Record<string, number>;

function bump(c: Counts, k: string, n: number) {
  if (n > 0) c[k] = (c[k] ?? 0) + n;
}

function optional(msg: string) {
  const l = msg.toLowerCase();
  return (
    l.includes("does not exist") ||
    l.includes("schema cache") ||
    l.includes("could not find the table")
  );
}

async function deleteIn(
  service: SupabaseClient,
  table: string,
  column: string,
  ids: string[],
  counts: Counts
) {
  if (ids.length === 0) return;
  const selectCol =
    table === "atleta_perfil_deportivo" ? "usuario_id" : "id";
  const { data, error } = await service
    .from(table)
    .delete()
    .in(column, ids)
    .select(selectCol);
  if (error) {
    if (optional(error.message)) return;
    throw new Error(`${table}: ${error.message}`);
  }
  bump(counts, table, data?.length ?? 0);
}

async function main() {
  const { service } = requireParabellumQaEnv();
  const emails = allQaEmails();
  assertOnlyQaEmails(emails);

  console.log("ATHRON Parabellum-10-QA — teardown\n");
  const box = await resolveParabellumBox(service);
  if (box.id !== PARABELLUM_BOX_ID) {
    console.error("FAIL — box ID mismatch");
    process.exit(1);
  }

  const snapshot = loadSnapshot();
  const countsBefore = await countSocios(service, box.id);
  const subBefore = await loadSubscriptionSnapshot(service, box.id);

  const auth = await listAuthUsersByEmail(service);
  const profileIds: string[] = [];
  const userIds: string[] = [];

  for (const email of emails) {
    assertQaEmail(email);
    const user = auth.get(email.toLowerCase());
    if (!user) continue;
    if (!isQaEmail(user.email)) {
      throw new Error(`Abortado: email no QA ${user.email}`);
    }
    const { data: p } = await service
      .from("profiles")
      .select("id, box_id, rol, nombre_completo")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!p) continue;
    if (p.box_id !== box.id) {
      throw new Error(`Abortado: ${email} en box ajeno ${p.box_id}`);
    }
    if (!p.nombre_completo?.startsWith("QA Parabellum Atleta")) {
      throw new Error(
        `Abortado: nombre no QA para ${email}: ${p.nombre_completo}`
      );
    }
    profileIds.push(p.id);
    userIds.push(user.id);
  }

  const { data: qaClases } = await service
    .from("clases")
    .select("id, nombre, box_id")
    .eq("box_id", box.id)
    .like("nombre", `${QA_CLASS_PREFIX}%`);

  for (const c of qaClases ?? []) {
    if (!c.nombre.startsWith(QA_CLASS_PREFIX) || c.box_id !== box.id) {
      throw new Error(`Abortado: clase fuera de alcance ${c.nombre}`);
    }
  }
  const claseIds = (qaClases ?? []).map((c) => c.id);

  console.log("Antes de borrar:");
  console.log(`  QA profiles: ${profileIds.length}`);
  console.log(`  QA clases: ${claseIds.length}`);
  console.log(`  socios reales: ${countsBefore.real}`);
  console.log(`  socios QA: ${countsBefore.qa}`);

  // Ensure no real athlete ids in delete set
  const { data: allSocios } = await service
    .from("profiles")
    .select("id, user_id")
    .eq("box_id", box.id)
    .eq("rol", "socio");
  for (const p of allSocios ?? []) {
    if (!profileIds.includes(p.id)) continue;
    const email = [...auth.values()].find((a) => a.id === p.user_id)?.email;
    if (!isQaEmail(email)) {
      throw new Error(`Abortado: profile real en set de borrado ${p.id}`);
    }
  }

  const counts: Counts = {};

  if (profileIds.length > 0) {
    const { data, error } = await service
      .from("ranking_point_events")
      .delete()
      .eq("box_id", box.id)
      .in("usuario_id", profileIds)
      .select("id");
    if (error && !optional(error.message)) {
      throw new Error(`ranking_point_events: ${error.message}`);
    }
    bump(counts, "ranking_point_events", data?.length ?? 0);
  }

  if (claseIds.length > 0) {
    await deleteIn(service, "clase_scores", "clase_id", claseIds, counts);
    await deleteIn(service, "reservas", "clase_id", claseIds, counts);
  }
  if (profileIds.length > 0) {
    await deleteIn(service, "clase_scores", "usuario_id", profileIds, counts);
    await deleteIn(service, "reservas", "usuario_id", profileIds, counts);
    for (const table of [
      "seguimientos_atleta",
      "atleta_skill_historial",
      "atleta_skills",
      "atleta_pr_marcas",
      "atleta_objetivos",
      "atleta_perfil_deportivo",
      "membresias",
    ] as const) {
      await deleteIn(service, table, "usuario_id", profileIds, counts);
    }
  }

  if (claseIds.length > 0) {
    await deleteIn(service, "clases", "id", claseIds, counts);
  }

  if (profileIds.length > 0) {
    const { data, error } = await service
      .from("profiles")
      .delete()
      .in("id", profileIds)
      .select("id");
    if (error) throw new Error(`profiles: ${error.message}`);
    bump(counts, "profiles", data?.length ?? 0);
  }

  let authDeleted = 0;
  for (const userId of userIds) {
    const entry = [...auth.entries()].find(([, u]) => u.id === userId);
    if (entry && !entry[0].startsWith(QA_EMAIL_PREFIX)) {
      throw new Error(`Abortado: auth no QA ${entry[0]}`);
    }
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) console.warn(`⚠ auth ${userId}: ${error.message}`);
    else authDeleted++;
  }
  bump(counts, "auth.users", authDeleted);

  const countsAfter = await countSocios(service, box.id);
  const subAfter = await loadSubscriptionSnapshot(service, box.id);

  const { count: leftClasses } = await service
    .from("clases")
    .select("id", { count: "exact", head: true })
    .eq("box_id", box.id)
    .like("nombre", `${QA_CLASS_PREFIX}%`);

  console.log("\nBorrado:");
  for (const [k, n] of Object.entries(counts).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    console.log(`  ${k}: ${n}`);
  }

  const realOk = snapshot
    ? countsAfter.real === snapshot.realAthleteCount
    : countsAfter.qa === 0;
  const subOk =
    subAfter.status === subBefore.status &&
    subAfter.planId === subBefore.planId &&
    subAfter.maxAtletas === subBefore.maxAtletas;

  addFinal("0 atletas QA", countsAfter.qa === 0, `qa=${countsAfter.qa}`);
  addFinal("0 clases QA", (leftClasses ?? 0) === 0, `clases=${leftClasses}`);
  addFinal("reales restaurados", realOk, `real=${countsAfter.real}`);
  addFinal("plan/sub/límite intactos", subOk, `${subAfter.status}/${subAfter.maxAtletas}`);

  if (countsAfter.qa !== 0 || (leftClasses ?? 0) !== 0 || !realOk || !subOk) {
    console.error("\nFAIL — teardown Parabellum-10-QA");
    process.exit(1);
  }

  console.log("\nPASS — teardown Parabellum-10-QA");
}

function addFinal(label: string, pass: boolean, detail: string) {
  console.log(`[${pass ? "PASS" : "FAIL"}] ${label} — ${detail}`);
}

main().catch((err) => {
  console.error("\nFAIL —", err);
  process.exit(1);
});
