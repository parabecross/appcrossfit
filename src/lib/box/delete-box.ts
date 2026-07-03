import { APP_CONFIG } from "@/lib/config/app-config";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

function isOptionalTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("does not exist") ||
    lower.includes("schema cache") ||
    lower.includes("could not find the table")
  );
}

async function deleteOptionalByBoxId(
  admin: AdminClient,
  table: string,
  boxId: string
): Promise<string | null> {
  const { error } = await admin.from(table).delete().eq("box_id", boxId);
  if (error && !isOptionalTableError(error.message)) {
    return `${table}: ${error.message}`;
  }
  return null;
}

async function deleteBoxScopedData(
  admin: AdminClient,
  boxId: string,
  boxProfileIds: string[]
) {
  await admin.from("ranking_point_events").delete().eq("box_id", boxId);
  await admin.from("ranking_monthly_awards").delete().eq("box_id", boxId);
  await admin.from("ranking_config").delete().eq("box_id", boxId);

  for (const table of ["box_feature_overrides", "box_subscriptions"] as const) {
    const err = await deleteOptionalByBoxId(admin, table, boxId);
    if (err) throw new Error(err);
  }

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

    const { error: skillHistErr } = await admin
      .from("atleta_skill_historial")
      .delete()
      .in("usuario_id", boxProfileIds);
    if (skillHistErr && !isOptionalTableError(skillHistErr.message)) {
      throw new Error(skillHistErr.message);
    }
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

function formatAuthDeleteError(error: unknown): string {
  if (error && typeof error === "object") {
    const authError = error as {
      message?: string;
      code?: string;
      status?: number;
    };
    if (authError.message) return authError.message;
    if (authError.code) return authError.code;
    try {
      return JSON.stringify(error);
    } catch {
      return "Error desconocido al eliminar usuario auth";
    }
  }
  return String(error);
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

  const normalizedConfirm = confirmSlug.trim().toLowerCase();
  if (box.slug.toLowerCase() !== normalizedConfirm) {
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
  const userIds = Array.from(new Set((profiles ?? []).map((p) => p.user_id)));

  try {
    await deleteBoxScopedData(admin, boxId, boxProfileIds);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al borrar datos del box",
    };
  }

  await deleteUserAvatars(admin, userIds);

  const { error: ownerErr } = await admin
    .from("boxes")
    .update({ owner_user_id: null })
    .eq("id", boxId);

  if (ownerErr) {
    return { ok: false, error: ownerErr.message };
  }

  if (boxProfileIds.length > 0) {
    const { error: profilesErr } = await admin
      .from("profiles")
      .delete()
      .in("id", boxProfileIds);

    if (profilesErr) {
      return { ok: false, error: profilesErr.message };
    }
  }

  for (const userId of userIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      return {
        ok: false,
        error: `Error al eliminar usuario auth: ${formatAuthDeleteError(error)}`,
      };
    }
  }

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
