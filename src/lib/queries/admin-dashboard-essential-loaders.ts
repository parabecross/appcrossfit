import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getBoxConfig } from "@/lib/box/config";
import { todayInTimezone } from "@/lib/dates/date-only";
import { resolveQueryBoxId } from "@/lib/queries/box-scope";
import type { AccountStatus } from "@/types/database";
import {
  getMembresiasMapForUsuarios,
  type MembresiaWithPlan,
} from "@/lib/queries/memberships";

export type DashboardEssentialContext = {
  resolvedBoxId: string;
  boxName: string;
  timezone: string;
  today: string;
};

export type BoxSociosMembershipSnapshot = {
  socios: Array<{
    id: string;
    nombre_completo: string;
    telefono: string | null;
    user_id: string;
    estado_cuenta: AccountStatus;
    foto_url: string | null;
    created_at: string;
  }>;
  memMap: Map<string, MembresiaWithPlan>;
};

export const loadDashboardEssentialContext = cache(
  async (boxId?: string): Promise<DashboardEssentialContext> => {
    const resolvedBoxId = await resolveQueryBoxId(boxId);
    const boxConfig = await getBoxConfig(resolvedBoxId);
    return {
      resolvedBoxId,
      boxName: boxConfig.name,
      timezone: boxConfig.timezone,
      today: todayInTimezone(boxConfig.timezone),
    };
  }
);

export const loadBoxSociosMembershipSnapshot = cache(
  async (resolvedBoxId: string): Promise<BoxSociosMembershipSnapshot> => {
    const supabase = await createClient();
    const { data: socios } = await supabase
      .from("profiles")
      .select("id, nombre_completo, telefono, user_id, estado_cuenta, foto_url, created_at")
      .eq("box_id", resolvedBoxId)
      .eq("rol", "socio")
      .order("nombre_completo");

    const list = socios ?? [];
    const memMap = await getMembresiasMapForUsuarios(list.map((s) => s.id));

    return { socios: list, memMap };
  }
);

export async function loadBirthdayDeportivoForSocios(socioIds: string[]) {
  if (socioIds.length === 0) return [];

  const supabase = await createClient();
  const { data: perfiles, error } = await supabase
    .from("atleta_perfil_deportivo")
    .select("usuario_id, fecha_nacimiento")
    .in("usuario_id", socioIds);

  if (error) {
    console.error("loadBirthdayDeportivoForSocios:", error.message);
    return [];
  }

  return perfiles ?? [];
}

export async function loadTodayReservas(claseIds: string[]) {
  if (claseIds.length === 0) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("reservas")
    .select("id, clase_id, usuario_id, estado, created_at")
    .in("clase_id", claseIds);

  return data ?? [];
}
