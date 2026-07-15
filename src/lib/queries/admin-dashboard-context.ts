import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getBoxConfig } from "@/lib/box/config";
import {
  getPreviousWeekRange,
  getWeekRangeInTimezone,
} from "@/lib/admin/dashboard-helpers";
import { todayInTimezone } from "@/lib/dates/date-only";
import { getMembresiasMapForUsuarios } from "@/lib/queries/memberships";
import { resolveQueryBoxId } from "@/lib/queries/box-scope";
import { getSocioDisplayStatus } from "@/lib/membresias/helpers";

async function getSocioProfiles(boxId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, nombre_completo, estado_cuenta, telefono, foto_url, created_at")
    .eq("box_id", boxId)
    .eq("rol", "socio")
    .order("nombre_completo");
  return data ?? [];
}

export type DashboardContext = {
  resolvedBoxId: string;
  boxConfig: Awaited<ReturnType<typeof getBoxConfig>>;
  today: string;
  weekRange: ReturnType<typeof getWeekRangeInTimezone>;
  prevWeekRange: ReturnType<typeof getPreviousWeekRange>;
  socios: Awaited<ReturnType<typeof getSocioProfiles>>;
  socioIds: string[];
  memMap: Awaited<ReturnType<typeof getMembresiasMapForUsuarios>>;
  activeSocioIds: string[];
  nombreMap: Map<string, string>;
  activeSocios: Awaited<ReturnType<typeof getSocioProfiles>>;
};

export const loadDashboardContext = cache(
  async (boxId?: string): Promise<DashboardContext> => {
    const resolvedBoxId = await resolveQueryBoxId(boxId);
    const boxConfig = await getBoxConfig(resolvedBoxId);
    const today = todayInTimezone(boxConfig.timezone);
    const weekRange = getWeekRangeInTimezone(boxConfig.timezone);
    const prevWeekRange = getPreviousWeekRange(boxConfig.timezone);
    const socios = await getSocioProfiles(resolvedBoxId);
    const socioIds = socios.map((s) => s.id);
    const memMap = await getMembresiasMapForUsuarios(socioIds);
    const activeSocioIds = socios
      .filter((s) => {
        const mem = memMap.get(s.id) ?? null;
        const status = getSocioDisplayStatus(s, mem, boxConfig.timezone);
        return status === "activo" || status === "por_vencer";
      })
      .map((s) => s.id);
    const nombreMap = new Map(socios.map((s) => [s.id, s.nombre_completo]));
    const activeSocios = socios.filter((s) => activeSocioIds.includes(s.id));

    return {
      resolvedBoxId,
      boxConfig,
      today,
      weekRange,
      prevWeekRange,
      socios,
      socioIds,
      memMap,
      activeSocioIds,
      nombreMap,
      activeSocios,
    };
  }
);
