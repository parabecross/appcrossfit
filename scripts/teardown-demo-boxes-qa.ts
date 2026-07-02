/**
 * Teardown QA manual multi-box: borra SOLO datos creados por seed-demo-boxes-qa.
 *
 *   ATHRON_QA_CONFIRM=true npm run teardown-demo-boxes
 *
 * Parabellum: no borra el box ni datos sin prefijo QA.
 * Beta: elimina el box qa-demo-box-beta y todo lo asociado.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BETA_CLASS_PREFIX,
  BETA_EMAILS,
  BETA_PLAN_NAME,
  BETA_SLUG,
  PARABELLUM_CLASS_PREFIX,
  PARABELLUM_EMAILS,
  PARABELLUM_PLAN_NAME,
  PARABELLUM_SLUG,
} from "./lib/qa-demo-boxes-constants";
import { requireQaScriptEnv } from "./lib/qa-demo-boxes-env";

type DeleteCounts = Record<string, number>;

function bump(counts: DeleteCounts, table: string, n: number) {
  if (n <= 0) return;
  counts[table] = (counts[table] ?? 0) + n;
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

async function profileIdsForEmails(
  service: SupabaseClient,
  emails: string[]
): Promise<string[]> {
  const authByEmail = await listAuthUsersByEmail(service);
  const userIds = emails
    .map((e) => authByEmail.get(e.toLowerCase()))
    .filter(Boolean) as string[];

  if (userIds.length === 0) return [];

  const { data, error } = await service
    .from("profiles")
    .select("id")
    .in("user_id", userIds);

  if (error) throw new Error(`profiles lookup: ${error.message}`);
  return (data ?? []).map((p) => p.id);
}

async function claseIdsWithPrefix(
  service: SupabaseClient,
  boxId: string,
  prefix: string
): Promise<string[]> {
  const { data, error } = await service
    .from("clases")
    .select("id")
    .eq("box_id", boxId)
    .like("nombre", `${prefix}%`);

  if (error) throw new Error(`clases lookup: ${error.message}`);
  return (data ?? []).map((c) => c.id);
}

async function deleteByIds(
  service: SupabaseClient,
  table: string,
  column: string,
  ids: string[],
  counts: DeleteCounts
): Promise<void> {
  if (ids.length === 0) return;
  const { data, error } = await service
    .from(table)
    .delete()
    .in(column, ids)
    .select("id");

  if (error) throw new Error(`${table} delete: ${error.message}`);
  bump(counts, table, data?.length ?? 0);
}

async function deleteReservasForQa(
  service: SupabaseClient,
  profileIds: string[],
  claseIds: string[],
  counts: DeleteCounts
): Promise<void> {
  const reservaIdSet = new Set<string>();

  if (profileIds.length > 0) {
    const { data, error } = await service
      .from("reservas")
      .select("id")
      .in("usuario_id", profileIds);
    if (error) throw new Error(`reservas lookup usuarios: ${error.message}`);
    for (const r of data ?? []) reservaIdSet.add(r.id);
  }

  if (claseIds.length > 0) {
    const { data, error } = await service
      .from("reservas")
      .select("id")
      .in("clase_id", claseIds);
    if (error) throw new Error(`reservas lookup clases: ${error.message}`);
    for (const r of data ?? []) reservaIdSet.add(r.id);
  }

  const reservaIds = Array.from(reservaIdSet);
  await deleteByIds(service, "reservas", "id", reservaIds, counts);
}

async function deleteRankingForUsers(
  service: SupabaseClient,
  boxId: string,
  profileIds: string[],
  counts: DeleteCounts
): Promise<void> {
  if (profileIds.length === 0) return;

  const { data, error } = await service
    .from("ranking_point_events")
    .delete()
    .eq("box_id", boxId)
    .in("usuario_id", profileIds)
    .select("id");

  if (error && !error.message.includes("ranking_point_events")) {
    throw new Error(`ranking_point_events: ${error.message}`);
  }
  bump(counts, "ranking_point_events", data?.length ?? 0);
}

async function deleteAtletaDataForUsers(
  service: SupabaseClient,
  profileIds: string[],
  counts: DeleteCounts
): Promise<void> {
  if (profileIds.length === 0) return;

  const tables = [
    "clase_scores",
    "atleta_pr_marcas",
    "atleta_skills",
    "atleta_skill_historial",
    "atleta_objetivos",
    "atleta_perfil_deportivo",
  ] as const;

  for (const table of tables) {
    const selectCol = table === "atleta_perfil_deportivo" ? "usuario_id" : "id";
    const { data, error } = await service
      .from(table)
      .delete()
      .in("usuario_id", profileIds)
      .select(selectCol);

    if (error) {
      if (error.message.includes("does not exist")) continue;
      throw new Error(`${table}: ${error.message}`);
    }
    bump(counts, table, data?.length ?? 0);
  }
}

async function deleteMembresiasForUsers(
  service: SupabaseClient,
  profileIds: string[],
  counts: DeleteCounts
): Promise<void> {
  if (profileIds.length === 0) return;
  const { data, error } = await service
    .from("membresias")
    .delete()
    .in("usuario_id", profileIds)
    .select("id");

  if (error) throw new Error(`membresias: ${error.message}`);
  bump(counts, "membresias", data?.length ?? 0);
}

async function deleteQaPlan(
  service: SupabaseClient,
  boxId: string,
  planName: string,
  counts: DeleteCounts
): Promise<void> {
  const { data, error } = await service
    .from("planes")
    .delete()
    .eq("box_id", boxId)
    .eq("nombre", planName)
    .select("id");

  if (error) throw new Error(`planes: ${error.message}`);
  bump(counts, "planes", data?.length ?? 0);
}

async function deleteQaAuthUsers(
  service: SupabaseClient,
  emails: string[],
  counts: DeleteCounts
): Promise<void> {
  const authByEmail = await listAuthUsersByEmail(service);
  for (const email of emails) {
    const authId = authByEmail.get(email.toLowerCase());
    if (!authId) continue;
    const { error } = await service.auth.admin.deleteUser(authId);
    if (error) {
      console.warn(`  ⚠ no se pudo borrar auth ${email}: ${error.message}`);
      continue;
    }
    bump(counts, "auth.users", 1);
  }
}

async function teardownParabellumQa(
  service: SupabaseClient,
  counts: DeleteCounts
): Promise<void> {
  const { data: boxes, error } = await service
    .from("boxes")
    .select("id, name, slug")
    .eq("slug", PARABELLUM_SLUG);

  if (error) throw new Error(`Parabellum lookup: ${error.message}`);
  if (!boxes || boxes.length !== 1) {
    console.warn(
      `  ⚠ Parabellum (${PARABELLUM_SLUG}) no encontrado exactamente 1 vez — omitiendo cleanup Parabellum`
    );
    return;
  }

  const box = boxes[0];
  console.log(`\nParabellum QA cleanup — ${box.name} (${box.id})`);

  const qaEmails = Object.values(PARABELLUM_EMAILS);
  const profileIds = await profileIdsForEmails(service, qaEmails);
  const claseIds = await claseIdsWithPrefix(
    service,
    box.id,
    PARABELLUM_CLASS_PREFIX
  );

  await deleteRankingForUsers(service, box.id, profileIds, counts);
  await deleteReservasForQa(service, profileIds, claseIds, counts);
  if (claseIds.length > 0) {
    await deleteByIds(service, "clase_scores", "clase_id", claseIds, counts);
  }
  await deleteAtletaDataForUsers(service, profileIds, counts);
  await deleteMembresiasForUsers(service, profileIds, counts);
  await deleteByIds(service, "clases", "id", claseIds, counts);
  await deleteQaAuthUsers(service, qaEmails, counts);
  await deleteQaPlan(service, box.id, PARABELLUM_PLAN_NAME, counts);
}

async function teardownBetaBox(
  service: SupabaseClient,
  counts: DeleteCounts
): Promise<void> {
  const { data: box, error } = await service
    .from("boxes")
    .select("id, name, slug")
    .eq("slug", BETA_SLUG)
    .maybeSingle();

  if (error) throw new Error(`Beta lookup: ${error.message}`);
  if (!box) {
    console.log("\nBeta QA cleanup — box no existe, nada que borrar");
    return;
  }

  console.log(`\nBeta QA cleanup — ${box.name} (${box.id})`);

  const qaEmails = Object.values(BETA_EMAILS);
  const profileIds = await profileIdsForEmails(service, qaEmails);
  const claseIds = await claseIdsWithPrefix(service, box.id, BETA_CLASS_PREFIX);

  await deleteRankingForUsers(service, box.id, profileIds, counts);
  await deleteReservasForQa(service, profileIds, claseIds, counts);
  if (claseIds.length > 0) {
    await deleteByIds(service, "clase_scores", "clase_id", claseIds, counts);
  }
  await deleteAtletaDataForUsers(service, profileIds, counts);
  await deleteMembresiasForUsers(service, profileIds, counts);
  await deleteByIds(service, "clases", "id", claseIds, counts);
  await deleteQaAuthUsers(service, qaEmails, counts);
  await deleteQaPlan(service, box.id, BETA_PLAN_NAME, counts);

  const { data: subs, error: subsErr } = await service
    .from("box_subscriptions")
    .delete()
    .eq("box_id", box.id)
    .select("id");
  if (subsErr) throw new Error(`box_subscriptions: ${subsErr.message}`);
  bump(counts, "box_subscriptions", subs?.length ?? 0);

  const { data: overrides, error: ovErr } = await service
    .from("box_feature_overrides")
    .delete()
    .eq("box_id", box.id)
    .select("id");
  if (ovErr && !ovErr.message.includes("box_feature_overrides")) {
    throw new Error(`box_feature_overrides: ${ovErr.message}`);
  }
  bump(counts, "box_feature_overrides", overrides?.length ?? 0);

  const { data: deletedBox, error: boxErr } = await service
    .from("boxes")
    .delete()
    .eq("id", box.id)
    .select("id");

  if (boxErr) throw new Error(`boxes: ${boxErr.message}`);
  bump(counts, "boxes", deletedBox?.length ?? 0);
}

function printDeleteSummary(label: string, counts: DeleteCounts) {
  console.log(`\n${label}`);
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  if (entries.length === 0) {
    console.log("  (sin filas borradas)");
    return;
  }
  for (const [table, n] of entries.sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${table}: ${n}`);
  }
}

async function main() {
  const { service } = requireQaScriptEnv();

  console.log("🧹 ATHRON QA — teardown demo boxes\n");

  const parabellumCounts: DeleteCounts = {};
  const betaCounts: DeleteCounts = {};

  await teardownParabellumQa(service, parabellumCounts);
  await teardownBetaBox(service, betaCounts);

  printDeleteSummary("Filas borradas — Parabellum QA", parabellumCounts);
  printDeleteSummary("Filas borradas — Beta QA", betaCounts);

  console.log("\n✓ Teardown QA completado.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
