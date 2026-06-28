import { createAdminClient } from "@/lib/supabase/admin";

export async function logAdminAction(params: {
  actorUserId: string;
  actorProfileId?: string | null;
  boxId?: string | null;
  accion: string;
  targetUserId?: string | null;
  targetProfileId?: string | null;
  detalle?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("audit_log").insert({
      actor_user_id: params.actorUserId,
      actor_profile_id: params.actorProfileId ?? null,
      box_id: params.boxId ?? null,
      accion: params.accion,
      target_user_id: params.targetUserId ?? null,
      target_profile_id: params.targetProfileId ?? null,
      detalle: params.detalle ?? null,
    });

    if (error) {
      console.error("[audit_log] insert failed:", error.message, {
        accion: params.accion,
        actorUserId: params.actorUserId,
      });
    }
  } catch (err) {
    console.error("[audit_log] unexpected error:", err, {
      accion: params.accion,
      actorUserId: params.actorUserId,
    });
  }
}
