import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import { redirect } from "next/navigation";

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return data;
}

export async function requireAuth(locale: string) {
  const profile = await getProfile();
  if (!profile) redirect(`/${locale}/login`);
  return profile;
}

export async function requireRole(
  locale: string,
  roles: Array<"admin" | "socio" | "coach">
) {
  const profile = await requireAuth(locale);
  if (!roles.includes(profile.rol)) {
    if (profile.rol === "admin") redirect(`/${locale}/admin/dashboard`);
    redirect(`/${locale}/mis-reservas`);
  }
  return profile;
}

export function getRedirectForRole(
  rol: Profile["rol"],
  locale: string
): string {
  if (rol === "admin") return `/${locale}/admin/dashboard`;
  if (rol === "coach") return `/${locale}/admin/clases`;
  return `/${locale}/mis-reservas`;
}
