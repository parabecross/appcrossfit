import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assertQueryBoxAccess } from "@/lib/queries/box-scope";
import type { Profile } from "@/types/database";

export type CoachWithEmail = Profile & { email: string | null };

export function isAssignableCoach(profile: Pick<Profile, "rol" | "is_super_admin">) {
  return profile.rol === "coach" && profile.is_super_admin !== true;
}

function filterAssignableCoachesForBox(
  profiles: Profile[] | null | undefined,
  boxId: string
): Profile[] {
  return (profiles ?? []).filter(
    (p) => p.box_id === boxId && isAssignableCoach(p)
  );
}

/** Coaches assignable to classes — strictly scoped to one box. */
export async function getAssignableCoachesForBox(
  boxId: string
): Promise<Profile[]> {
  await assertQueryBoxAccess(boxId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("box_id", boxId)
    .eq("rol", "coach")
    .eq("is_super_admin", false)
    .order("nombre_completo");

  return filterAssignableCoachesForBox(data, boxId);
}

/** Validates coach_id belongs to the box and is an assignable coach (not admin/super admin). */
export async function validateCoachIdForBox(
  coachId: string | null | undefined,
  boxId: string
): Promise<{ ok: true; coachId: string | null } | { ok: false; error: string }> {
  if (!coachId) return { ok: true, coachId: null };

  await assertQueryBoxAccess(boxId);

  const supabase = await createClient();
  const { data: coach } = await supabase
    .from("profiles")
    .select("id, box_id, rol, is_super_admin")
    .eq("id", coachId)
    .eq("box_id", boxId)
    .maybeSingle();

  if (!coach || !isAssignableCoach(coach)) {
    return { ok: false, error: "Coach no válido para este box" };
  }

  return { ok: true, coachId };
}

export async function getCoachesWithEmail(
  boxId: string
): Promise<CoachWithEmail[]> {
  const profiles = await getAssignableCoachesForBox(boxId);

  if (!profiles.length) return [];

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
