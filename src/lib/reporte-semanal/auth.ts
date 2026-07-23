import { isAdminLikeRole } from "@/lib/auth/roles";
import {
  assertFeatureEnabled,
  getBoxEntitlements,
} from "@/lib/entitlements/engine";
import { EntitlementError } from "@/lib/entitlements/types";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export type ReportAuthOk = {
  ok: true;
  boxId: string;
  profileId: string;
};

export type ReportAuthFail = {
  ok: false;
  status: number;
  error: string;
};

/**
 * Autenticación + rol admin-like + feature resumen_semanal.
 * El box se resuelve SOLO desde el perfil de sesión.
 */
export async function authorizeWeeklyReportAccess(): Promise<
  ReportAuthOk | ReportAuthFail
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: "No autorizado" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, box_id, rol")
    .eq("user_id", user.id)
    .single();

  if (!profile?.box_id || !isAdminLikeRole(profile.rol)) {
    return { ok: false, status: 403, error: "Acceso denegado" };
  }

  try {
    const ent = await getBoxEntitlements(profile.box_id);
    assertFeatureEnabled(ent, "resumen_semanal");
  } catch (e) {
    if (e instanceof EntitlementError) {
      return { ok: false, status: e.status, error: e.message };
    }
    throw e;
  }

  return { ok: true, boxId: profile.box_id, profileId: profile.id };
}

/** Helper puro para tests de aislamiento / rechazo. */
export function canAccessWeeklyReport(input: {
  authenticated: boolean;
  rol: UserRole | null;
  boxId: string | null;
  featureEnabled: boolean;
}): { allowed: boolean; reason?: string } {
  if (!input.authenticated) return { allowed: false, reason: "unauthenticated" };
  if (!input.boxId) return { allowed: false, reason: "no_box" };
  if (!input.rol || !isAdminLikeRole(input.rol)) {
    return { allowed: false, reason: "forbidden_role" };
  }
  if (!input.featureEnabled) {
    return { allowed: false, reason: "feature_disabled" };
  }
  return { allowed: true };
}
