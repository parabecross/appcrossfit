import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/get-profile";

/** Ensures the requested box matches the signed-in user's box (unless super admin). */
export async function assertQueryBoxAccess(requestedBoxId: string): Promise<string> {
  const profile = await getProfile();
  if (!profile?.box_id) {
    throw new Error("Sin box asignado en la sesión");
  }
  if (requestedBoxId !== profile.box_id && !profile.is_super_admin) {
    throw new Error("Acceso denegado: box no autorizado");
  }
  return requestedBoxId;
}

export async function resolveQueryBoxId(explicitBoxId?: string): Promise<string> {
  const profile = await getProfile();
  if (!profile?.box_id) {
    throw new Error("Sin box asignado en la sesión");
  }
  if (explicitBoxId) {
    return assertQueryBoxAccess(explicitBoxId);
  }
  return profile.box_id;
}

export async function getBoxStaffProfileIds(boxId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("box_id", boxId)
    .in("rol", ["coach", "admin", "box_admin"]);

  return (data ?? []).map((p) => p.id);
}

export async function getBoxProfileIds(boxId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("box_id", boxId);

  return (data ?? []).map((p) => p.id);
}
