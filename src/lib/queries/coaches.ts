import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveQueryBoxId } from "@/lib/queries/box-scope";
import type { Profile } from "@/types/database";

export type CoachWithEmail = Profile & { email: string | null };

export async function getCoachesWithEmail(
  boxId?: string
): Promise<CoachWithEmail[]> {
  const resolvedBoxId = await resolveQueryBoxId(boxId);
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("box_id", resolvedBoxId)
    .eq("rol", "coach")
    .order("nombre_completo");

  if (!profiles?.length) return [];

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return profiles.map((p) => ({ ...p, email: null }));
  }

  const admin = createAdminClient();
  const coaches: CoachWithEmail[] = [];

  for (const profile of profiles) {
    const { data: authData } = await admin.auth.admin.getUserById(
      profile.user_id
    );
    coaches.push({
      ...profile,
      email: authData.user?.email ?? null,
    });
  }

  return coaches;
}
