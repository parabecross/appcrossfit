/**
 * Teardown del box load-test-25 y usuarios loadtest25.*.
 *
 *   ATHRON_LOAD_TEST_CONFIRM=true npm run loadtest:25:teardown
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LOAD_TEST_EMAIL_PREFIX,
  LOAD_TEST_SLUG,
  allLoadTestEmails,
  assertLoadTestEmail,
} from "./lib/load-test-25-constants";
import {
  assertOnlyLoadTestEmails,
  listAuthUsersByEmail,
  requireLoadTestEnv,
} from "./lib/load-test-25-env";

type DeleteCounts = Record<string, number>;

function bump(counts: DeleteCounts, table: string, n: number) {
  if (n <= 0) return;
  counts[table] = (counts[table] ?? 0) + n;
}

function isOptionalTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("does not exist") ||
    lower.includes("schema cache") ||
    lower.includes("could not find the table")
  );
}

async function deleteIn(
  service: SupabaseClient,
  table: string,
  column: string,
  ids: string[],
  counts: DeleteCounts
) {
  if (ids.length === 0) return;
  const { data, error } = await service
    .from(table)
    .delete()
    .in(column, ids)
    .select(column === "usuario_id" && table === "atleta_perfil_deportivo" ? "usuario_id" : "id");

  if (error) {
    if (isOptionalTableError(error.message)) return;
    throw new Error(`${table}: ${error.message}`);
  }
  bump(counts, table, data?.length ?? 0);
}

async function snapshotOtherBoxes(
  service: SupabaseClient
): Promise<Map<string, number>> {
  const { data, error } = await service.from("boxes").select("id, slug");
  if (error) throw error;
  const map = new Map<string, number>();
  for (const b of data ?? []) {
    if (b.slug === LOAD_TEST_SLUG) continue;
    const { count } = await service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("box_id", b.id);
    map.set(b.id, count ?? 0);
  }
  return map;
}

async function main() {
  const { service } = requireLoadTestEnv();
  const emails = allLoadTestEmails();
  assertOnlyLoadTestEmails(emails);
  for (const e of emails) assertLoadTestEmail(e);

  console.log("ATHRON load-test-25 — teardown\n");

  const beforeOthers = await snapshotOtherBoxes(service);

  const { data: boxes, error: boxErr } = await service
    .from("boxes")
    .select("id, name, slug")
    .eq("slug", LOAD_TEST_SLUG);

  if (boxErr) throw new Error(boxErr.message);

  if (!boxes || boxes.length === 0) {
    console.log("Box no existe — nada que borrar");
    console.log("\nPASS — teardown (noop)");
    return;
  }

  if (boxes.length !== 1 || boxes[0].slug !== LOAD_TEST_SLUG) {
    console.error("FAIL — slug inesperado");
    process.exit(1);
  }

  const box = boxes[0];
  const counts: DeleteCounts = {};

  const { data: profiles } = await service
    .from("profiles")
    .select("id, user_id, is_super_admin")
    .eq("box_id", box.id);

  const removable = (profiles ?? []).filter((p) => !p.is_super_admin);
  const profileIds = removable.map((p) => p.id);
  const userIds = removable.map((p) => p.user_id);

  const auth = await listAuthUsersByEmail(service);
  for (const email of emails) {
    const id = auth.get(email.toLowerCase());
    if (id && !userIds.includes(id)) userIds.push(id);
  }

  console.log("Antes de borrar:");
  console.log(`  box=${box.name} (${box.id})`);
  console.log(`  profiles=${profileIds.length}`);
  console.log(`  auth users loadtest25=${emails.filter((e) => auth.has(e.toLowerCase())).length}`);

  const { data: clases } = await service
    .from("clases")
    .select("id")
    .eq("box_id", box.id);
  const claseIds = (clases ?? []).map((c) => c.id);
  console.log(`  clases=${claseIds.length}`);

  {
    const { data, error } = await service
      .from("ranking_point_events")
      .delete()
      .eq("box_id", box.id)
      .select("id");
    if (error && !isOptionalTableError(error.message)) {
      throw new Error(`ranking_point_events: ${error.message}`);
    }
    bump(counts, "ranking_point_events", data?.length ?? 0);
  }
  {
    const { data, error } = await service
      .from("ranking_monthly_awards")
      .delete()
      .eq("box_id", box.id)
      .select("id");
    if (error && !isOptionalTableError(error.message)) {
      throw new Error(`ranking_monthly_awards: ${error.message}`);
    }
    bump(counts, "ranking_monthly_awards", data?.length ?? 0);
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

  {
    const { data, error } = await service
      .from("planes")
      .delete()
      .eq("box_id", box.id)
      .select("id");
    if (error) throw new Error(`planes: ${error.message}`);
    bump(counts, "planes", data?.length ?? 0);
  }

  {
    const { data, error } = await service
      .from("ranking_config")
      .delete()
      .eq("box_id", box.id)
      .select("box_id");
    if (error && !isOptionalTableError(error.message)) {
      throw new Error(`ranking_config: ${error.message}`);
    }
    bump(counts, "ranking_config", data?.length ?? 0);
  }

  {
    const { data, error } = await service
      .from("box_feature_overrides")
      .delete()
      .eq("box_id", box.id)
      .select("id");
    if (error && !isOptionalTableError(error.message)) {
      throw new Error(`box_feature_overrides: ${error.message}`);
    }
    bump(counts, "box_feature_overrides", data?.length ?? 0);
  }

  {
    const { data, error } = await service
      .from("box_subscriptions")
      .delete()
      .eq("box_id", box.id)
      .select("id");
    if (error) throw new Error(`box_subscriptions: ${error.message}`);
    bump(counts, "box_subscriptions", data?.length ?? 0);
  }

  {
    const { error } = await service
      .from("audit_log")
      .delete()
      .eq("box_id", box.id);
    if (error && !isOptionalTableError(error.message)) {
      throw new Error(`audit_log: ${error.message}`);
    }
  }

  await service.from("boxes").update({ owner_user_id: null }).eq("id", box.id);

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
    const emailEntry = [...auth.entries()].find(([, id]) => id === userId);
    if (emailEntry) {
      if (!emailEntry[0].startsWith(LOAD_TEST_EMAIL_PREFIX)) {
        throw new Error(
          `Abortado: intento de borrar auth fuera de loadtest25: ${emailEntry[0]}`
        );
      }
    }
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) {
      console.warn(`  ⚠ auth no borrado ${userId}: ${error.message}`);
    } else {
      authDeleted++;
    }
  }
  bump(counts, "auth.users", authDeleted);

  {
    const { data, error } = await service
      .from("boxes")
      .delete()
      .eq("id", box.id)
      .eq("slug", LOAD_TEST_SLUG)
      .select("id");
    if (error) throw new Error(`boxes: ${error.message}`);
    bump(counts, "boxes", data?.length ?? 0);
  }

  const afterOthers = await snapshotOtherBoxes(service);
  let othersOk = true;
  for (const [id, before] of beforeOthers) {
    const after = afterOthers.get(id) ?? before;
    if (after !== before) {
      othersOk = false;
      console.error(
        `FAIL — box ${id} profiles cambió ${before} → ${after}`
      );
    }
  }

  console.log("\nFilas borradas:");
  for (const [table, n] of Object.entries(counts).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    console.log(`  ${table}: ${n}`);
  }

  const { data: leftover } = await service
    .from("boxes")
    .select("id")
    .eq("slug", LOAD_TEST_SLUG);
  if (leftover && leftover.length > 0) {
    console.error("\nFAIL — box aún existe");
    process.exit(1);
  }

  if (!othersOk) {
    console.error("\nFAIL — otros boxes afectados");
    process.exit(1);
  }

  console.log("\nPASS — teardown load-test-25");
}

main().catch((err) => {
  console.error("\nFAIL —", err);
  process.exit(1);
});
