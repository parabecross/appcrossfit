import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/get-profile";

export async function resolveQueryBoxId(explicitBoxId?: string): Promise<string> {
  if (explicitBoxId) return explicitBoxId;
  const profile = await getProfile();
  if (!profile?.box_id) {
    throw new Error("Sin box asignado en la sesión");
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
