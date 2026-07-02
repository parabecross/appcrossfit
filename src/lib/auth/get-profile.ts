import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";
import { redirect } from "next/navigation";
import { canAccessAdminArea, isAdminLikeRole } from "@/lib/auth/roles";

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select(
      "id, user_id, nombre_completo, telefono, foto_url, bio, rol, box_id, is_super_admin, estado_cuenta, created_at, updated_at"
    )
    .eq("user_id", user.id)
    .single();

  return data;
}

export async function requireAuth(locale: string) {
  const profile = await getProfile();
  if (!profile) redirect(`/${locale}/login`);
  return profile;
}

export async function requireRole(locale: string, roles: UserRole[]) {
  const profile = await requireAuth(locale);
  if (!roles.includes(profile.rol)) {
    redirect(getRedirectForRole(profile.rol, locale));
  }
  return profile;
}

export async function requireAdmin(locale: string) {
  const profile = await requireAuth(locale);
  if (profile.rol === "coach") redirect(`/${locale}/admin/clases`);
  if (!isAdminLikeRole(profile.rol)) redirect(`/${locale}/mis-reservas`);
  return profile;
}

export async function requireSuperAdmin(locale: string) {
  const profile = await requireAuth(locale);
  if (!profile.is_super_admin) {
    redirect(getRedirectForRole(profile.rol, locale));
  }
  return profile;
}

export function getRedirectForRole(
  rol: Profile["rol"],
  locale: string,
  isSuperAdmin = false
): string {
  if (isSuperAdmin) return `/${locale}/admin-athron/dashboard`;
  if (isAdminLikeRole(rol)) return `/${locale}/admin/dashboard`;
  if (rol === "coach") return `/${locale}/admin/clases`;
  return `/${locale}/mis-reservas`;
}

export { canAccessAdminArea, isAdminLikeRole };
