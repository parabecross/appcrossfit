import { APP_CONFIG } from "@/lib/config/app-config";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

async function deleteBoxScopedData(
  admin: AdminClient,
  boxId: string,
  staffIds: string[],
  boxProfileIds: string[]
) {
  await admin.from("ranking_point_events").delete().eq("box_id", boxId);
  await admin.from("ranking_monthly_awards").delete().eq("box_id", boxId);
  await admin.from("ranking_config").delete().eq("box_id", boxId);

  const claseIdSet = new Set<string>();

  const { data: boxClases } = await admin
    .from("clases")
    .select("id")
    .eq("box_id", boxId);
  for (const c of boxClases ?? []) claseIdSet.add(c.id);

  if (boxProfileIds.length > 0) {
    const { data: reservas } = await admin
      .from("reservas")
      .select("clase_id")
      .in("usuario_id", boxProfileIds);
    for (const r of reservas ?? []) claseIdSet.add(r.clase_id);
  }

  const claseIds = Array.from(claseIdSet);
  if (claseIds.length > 0) {
    await admin.from("clase_scores").delete().in("clase_id", claseIds);
    await admin.from("reservas").delete().in("clase_id", claseIds);
    await admin.from("clases").delete().in("id", claseIds);
  }

  if (boxProfileIds.length > 0) {
    await admin.from("clase_scores").delete().in("usuario_id", boxProfileIds);
    await admin.from("reservas").delete().in("usuario_id", boxProfileIds);
    await admin.from("membresias").delete().in("usuario_id", boxProfileIds);
    await admin.from("atleta_pr_marcas").delete().in("usuario_id", boxProfileIds);
    await admin.from("atleta_skills").delete().in("usuario_id", boxProfileIds);
    await admin.from("atleta_objetivos").delete().in("usuario_id", boxProfileIds);
    await admin.from("atleta_perfil_deportivo").delete().in("usuario_id", boxProfileIds);
  }

  await admin.from("audit_log").delete().eq("box_id", boxId);
  await admin.from("planes").delete().eq("box_id", boxId);
}

async function deleteUserAvatars(
  admin: AdminClient,
  userIds: string[]
): Promise<void> {
  for (const userId of userIds) {
    const { data: files } = await admin.storage.from("avatars").list(userId);
    if (!files?.length) continue;
    const paths = files.map((f) => `${userId}/${f.name}`);
    await admin.storage.from("avatars").remove(paths);
  }
}

export type DeleteBoxResult =
  | { ok: true; deletedUsers: number; deletedProfiles: number }
  | { ok: false; error: string };

export async function deleteBoxPermanently(
  boxId: string,
  confirmSlug: string
): Promise<DeleteBoxResult> {
  const admin = createAdminClient();

  const { data: box, error: boxErr } = await admin
    .from("boxes")
    .select("id, slug, name, status")
    .eq("id", boxId)
    .single();

  if (boxErr || !box) {
    return { ok: false, error: "Box no encontrado" };
  }

  if (box.slug !== confirmSlug.trim()) {
    return { ok: false, error: "El slug de confirmación no coincide" };
  }

  if (box.slug === APP_CONFIG.DEFAULT_BOX_SLUG) {
    return {
      ok: false,
      error: `No se puede eliminar el box demo «${APP_CONFIG.DEFAULT_BOX_NAME}»`,
    };
  }

  if (box.status === "active") {
    return {
      ok: false,
      error: "Desactiva el box antes de eliminarlo permanentemente",
    };
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, user_id, rol, is_super_admin")
    .eq("box_id", boxId);

  if (profiles?.some((p) => p.is_super_admin)) {
    return {
      ok: false,
      error: "Este box tiene un super admin. Reasígnalo antes de eliminar.",
    };
  }

  const boxProfileIds = (profiles ?? []).map((p) => p.id);
  const staffIds = (profiles ?? [])
    .filter((p) => ["admin", "coach", "box_admin"].includes(p.rol))
    .map((p) => p.id);
  const userIds = Array.from(new Set((profiles ?? []).map((p) => p.user_id)));

  await deleteBoxScopedData(admin, boxId, staffIds, boxProfileIds);

  await deleteUserAvatars(admin, userIds);

  for (const userId of userIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      return {
        ok: false,
        error: `Error al eliminar usuario auth: ${error.message}`,
      };
    }
  }

  const { count: remainingProfiles } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("box_id", boxId);

  if (remainingProfiles && remainingProfiles > 0) {
    const { error: profilesErr } = await admin
      .from("profiles")
      .delete()
      .eq("box_id", boxId);
    if (profilesErr) {
      return { ok: false, error: profilesErr.message };
    }
  }

  await admin
    .from("boxes")
    .update({ owner_user_id: null })
    .eq("id", boxId);

  const { error: boxDeleteErr } = await admin
    .from("boxes")
    .delete()
    .eq("id", boxId);

  if (boxDeleteErr) {
    return { ok: false, error: boxDeleteErr.message };
  }

  return {
    ok: true,
    deletedUsers: userIds.length,
    deletedProfiles: boxProfileIds.length,
  };
}
