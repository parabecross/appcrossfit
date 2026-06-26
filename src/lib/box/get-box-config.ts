import { createClient } from "@/lib/supabase/server";
import { APP_CONFIG } from "@/lib/config/app-config";
import { getProfile } from "@/lib/auth/get-profile";
import type { BoxConfig } from "@/lib/box/config";
import { getDefaultBoxConfig } from "@/lib/box/config";

export async function getBoxConfig(boxId: string | null | undefined): Promise<BoxConfig> {
  if (!boxId) return getDefaultBoxConfig();

  const supabase = await createClient();
  const { data } = await supabase
    .from("boxes")
    .select("id, name, slug, timezone, logo_url")
    .eq("id", boxId)
    .maybeSingle();

  if (!data) return getDefaultBoxConfig();

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    timezone: data.timezone ?? APP_CONFIG.GYM_TIMEZONE,
    logoUrl: data.logo_url,
    platformBrand: APP_CONFIG.BRAND_NAME,
  };
}

export async function getBoxConfigForSession(): Promise<BoxConfig> {
  const profile = await getProfile();
  return getBoxConfig(profile?.box_id);
}
