import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ISOLATION_TEST_BOX_SLUGS,
  ISOLATION_TEST_EMAILS,
} from "./isolation-test-constants";

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

async function deleteIn(
  service: SupabaseClient,
  table: string,
  column: string,
  ids: string[]
) {
  if (ids.length === 0) return;
  const { error } = await service.from(table).delete().in(column, ids);
  if (error && !isOptionalTableError(error.message)) {
    throw new Error(`${table}: ${error.message}`);
  }
}

function isOptionalTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("does not exist") ||
    lower.includes("schema cache") ||
    lower.includes("could not find the table")
  );
}

async function deleteOptionalByBoxId(
  service: SupabaseClient,
  table: string,
  boxId: string
) {
  const { error } = await service.from(table).delete().eq("box_id", boxId);
  if (error && !isOptionalTableError(error.message)) {
    throw new Error(`${table}: ${error.message}`);
  }
}

async function deleteBoxAndUsers(
  service: SupabaseClient,
  boxId: string
): Promise<{ deletedUsers: number; deletedProfiles: number }> {
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

  await deleteOptionalByBoxId(service, "ranking_point_events", boxId);
  await deleteOptionalByBoxId(service, "ranking_monthly_awards", boxId);
  await deleteOptionalByBoxId(service, "ranking_config", boxId);
  await deleteOptionalByBoxId(service, "box_feature_overrides", boxId);
  await deleteOptionalByBoxId(service, "box_subscriptions", boxId);

  if (claseIds.length > 0) {
    await deleteIn(service, "clase_scores", "clase_id", claseIds);
    await deleteIn(service, "reservas", "clase_id", claseIds);
    await deleteIn(service, "clases", "id", claseIds);
  }

  if (profileIds.length > 0) {
    await deleteIn(service, "clase_scores", "usuario_id", profileIds);
    await deleteIn(service, "reservas", "usuario_id", profileIds);
    await deleteIn(service, "membresias", "usuario_id", profileIds);
    await deleteIn(service, "atleta_pr_marcas", "usuario_id", profileIds);
    await deleteIn(service, "atleta_skills", "usuario_id", profileIds);
    await deleteIn(service, "atleta_objetivos", "usuario_id", profileIds);
    await deleteIn(service, "atleta_perfil_deportivo", "usuario_id", profileIds);

    const { error: skillHistErr } = await service
      .from("atleta_skill_historial")
      .delete()
      .in("usuario_id", profileIds);
    if (skillHistErr && !isOptionalTableError(skillHistErr.message)) {
      throw new Error(`atleta_skill_historial: ${skillHistErr.message}`);
    }
  }

  await service.from("planes").delete().eq("box_id", boxId);
  await deleteOptionalByBoxId(service, "audit_log", boxId);

  const { error: ownerErr } = await service
    .from("boxes")
    .update({ owner_user_id: null })
    .eq("id", boxId);
  if (ownerErr) throw new Error(`boxes owner clear: ${ownerErr.message}`);

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
      console.warn(`  ⚠ auth user no borrado ${userId}: ${error.message}`);
    }
  }

  const { error: boxDeleteErr } = await service
    .from("boxes")
    .delete()
    .eq("id", boxId);

  if (boxDeleteErr) throw new Error(`boxes delete: ${boxDeleteErr.message}`);

  return { deletedUsers: userIds.length, deletedProfiles: profileIds.length };
}

export type TeardownIsolationResult = {
  removedBoxes: string[];
  deletedUsers: number;
  deletedProfiles: number;
};

/**
 * Borra permanentemente Test Box A/B y usuarios @athron.test del check de aislamiento CI.
 */
export async function teardownIsolationTestBoxes(
  service: SupabaseClient
): Promise<TeardownIsolationResult> {
  const slugs = Object.values(ISOLATION_TEST_BOX_SLUGS);
  const removedBoxes: string[] = [];
  let deletedUsers = 0;
  let deletedProfiles = 0;

  for (const slug of slugs) {
    const { data: box, error } = await service
      .from("boxes")
      .select("id, name")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw new Error(`lookup ${slug}: ${error.message}`);
    if (!box) continue;

    console.log(`  → Eliminando «${box.name}» (${slug})…`);
    const stats = await deleteBoxAndUsers(service, box.id);
    deletedUsers += stats.deletedUsers;
    deletedProfiles += stats.deletedProfiles;
    removedBoxes.push(slug);
  }

  const authByEmail = await listAuthUsersByEmail(service);
  const orphanEmails = Object.values(ISOLATION_TEST_EMAILS);
  for (const email of orphanEmails) {
    const authId = authByEmail.get(email.toLowerCase());
    if (!authId) continue;
    const { error } = await service.auth.admin.deleteUser(authId);
    if (error) {
      console.warn(`  ⚠ orphan auth ${email}: ${error.message}`);
    } else {
      console.log(`  → Auth huérfano eliminado: ${email}`);
      deletedUsers++;
    }
  }

  return { removedBoxes, deletedUsers, deletedProfiles };
}
