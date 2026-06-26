import { APP_CONFIG } from "@/lib/config/app-config";

export interface BoxConfig {
  id: string | null;
  name: string;
  slug: string;
  timezone: string;
  logoUrl: string | null;
  /** Marca de plataforma (ATHRON) — no confundir con `name` del box */
  platformBrand: string;
}

/** Defaults cuando no hay box en sesión */
export function getDefaultBoxConfig(): BoxConfig {
  return {
    id: null,
    name: APP_CONFIG.DEFAULT_BOX_NAME,
    slug: APP_CONFIG.DEFAULT_BOX_SLUG,
    timezone: APP_CONFIG.GYM_TIMEZONE,
    logoUrl: null,
    platformBrand: APP_CONFIG.BRAND_NAME,
  };
}

export { getBoxConfig, getBoxConfigForSession } from "@/lib/box/get-box-config";
