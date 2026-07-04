import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBoxConfig } from "@/lib/box/config";
import { resolveQueryBoxId } from "@/lib/queries/box-scope";
import { getSocioDisplayStatus } from "@/lib/membresias/helpers";
import type { AlertaMembresia, Membresia, Plan, AccountStatus } from "@/types/database";

const MEMBRESIA_SELECT =
  "id, usuario_id, plan_id, fecha_inicio, fecha_fin, estado, metodo_asignacion, notas, created_at, updated_at, plan:planes(id, nombre, tipo, duracion_dias, precio, activo, box_id, created_at)";

export type MembresiaWithPlan = Omit<Membresia, "plan"> & { plan: Plan | null };

function normalizeMembresiaRow(row: {
  id: string;
  usuario_id: string;
  plan_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: Membresia["estado"];
  metodo_asignacion: Membresia["metodo_asignacion"];
  notas: string | null;
  created_at: string;
  updated_at: string;
  plan?: Plan | Plan[] | null;
}): MembresiaWithPlan {
  const { plan: rawPlan, ...rest } = row;
  const plan = Array.isArray(rawPlan) ? (rawPlan[0] ?? null) : (rawPlan ?? null);
  return { ...rest, plan };
}

export async function getMembresiaActual(
  profileId: string
): Promise<MembresiaWithPlan | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("membresias")
    .select(MEMBRESIA_SELECT)
    .eq("usuario_id", profileId)
    .in("estado", ["vigente", "vencida"])
    .order("fecha_fin", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data
    ? normalizeMembresiaRow(
        data as Parameters<typeof normalizeMembresiaRow>[0]
      )
    : null;
}

export async function getMembresiasMapForUsuarios(usuarioIds: string[]) {
  if (usuarioIds.length === 0) {
    return new Map<string, MembresiaWithPlan>();
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("membresias")
    .select(MEMBRESIA_SELECT)
    .in("usuario_id", usuarioIds)
    .in("estado", ["vigente", "vencida"])
    .order("fecha_fin", { ascending: false });

  const map = new Map<string, MembresiaWithPlan>();
  for (const m of data ?? []) {
    if (!map.has(m.usuario_id)) {
      map.set(
        m.usuario_id,
        normalizeMembresiaRow(m as Parameters<typeof normalizeMembresiaRow>[0])
      );
    }
  }
  return map;
}

/**
 * Membresías de socios del box (service role).
 * Coaches no pasan RLS de membresias_select (solo is_admin()); la página mis-atletas
 * ya validó auth y que los IDs son socios del mismo box_id.
 */
export async function getMembresiasMapForUsuariosInBox(
  usuarioIds: string[],
  boxId: string
) {
  if (usuarioIds.length === 0) {
    return new Map<string, MembresiaWithPlan>();
  }

  const admin = createAdminClient();

  const { data: allowedProfiles } = await admin
    .from("profiles")
    .select("id")
    .in("id", usuarioIds)
    .eq("box_id", boxId)
    .eq("rol", "socio");

  const allowedIds = new Set((allowedProfiles ?? []).map((p) => p.id));
  if (allowedIds.size === 0) {
    return new Map<string, MembresiaWithPlan>();
  }

  const { data } = await admin
    .from("membresias")
    .select(MEMBRESIA_SELECT)
    .in("usuario_id", [...allowedIds])
    .in("estado", ["vigente", "vencida"])
    .order("fecha_fin", { ascending: false });

  const map = new Map<string, MembresiaWithPlan>();
  for (const m of data ?? []) {
    if (!allowedIds.has(m.usuario_id)) continue;
    if (!map.has(m.usuario_id)) {
      map.set(
        m.usuario_id,
        normalizeMembresiaRow(m as Parameters<typeof normalizeMembresiaRow>[0])
      );
    }
  }
  return map;
}

export async function getAlertasMembresia(boxId?: string) {
  const resolvedBoxId = await resolveQueryBoxId(boxId);
  const boxConfig = await getBoxConfig(resolvedBoxId);
  const supabase = await createClient();
  const { data: socios } = await supabase
    .from("profiles")
    .select("id, nombre_completo, telefono, user_id, estado_cuenta")
    .eq("box_id", resolvedBoxId)
    .eq("rol", "socio");

  if (!socios) return [];

  const memMap = await getMembresiasMapForUsuarios(socios.map((s) => s.id));
  return computeAlertasMembresiaFromSocios(socios, memMap, boxConfig.timezone);
}

export function computeAlertasMembresiaFromSocios(
  socios: Array<{
    id: string;
    nombre_completo: string;
    telefono: string | null;
    user_id: string;
    estado_cuenta: AccountStatus;
  }>,
  memMap: Map<string, MembresiaWithPlan>,
  timezone: string
): AlertaMembresia[] {
  const alertas: AlertaMembresia[] = [];

  for (const s of socios) {
    const mem = memMap.get(s.id) ?? null;
    const displayStatus = getSocioDisplayStatus(s, mem, timezone);

    if (displayStatus === "vencida" || displayStatus === "sin_membresia") {
      alertas.push({
        profile_id: s.id,
        nombre_completo: s.nombre_completo,
        telefono: s.telefono,
        user_id: s.user_id,
        plan_nombre: mem?.plan?.nombre ?? null,
        fecha_fin: mem?.fecha_fin ?? null,
        tipo_alerta: "vencida",
      });
    } else if (displayStatus === "por_vencer" && mem) {
      alertas.push({
        profile_id: s.id,
        nombre_completo: s.nombre_completo,
        telefono: s.telefono,
        user_id: s.user_id,
        plan_nombre: mem.plan?.nombre ?? null,
        fecha_fin: mem.fecha_fin,
        tipo_alerta: "por_vencer",
      });
    }
  }
  return alertas;
}

export async function getKpis(boxId?: string) {
  const resolvedBoxId = await resolveQueryBoxId(boxId);
  const boxConfig = await getBoxConfig(resolvedBoxId);
  const supabase = await createClient();
  const { data: socios } = await supabase
    .from("profiles")
    .select("id, estado_cuenta")
    .eq("box_id", resolvedBoxId)
    .eq("rol", "socio");

  const memMap = await getMembresiasMapForUsuarios(
    (socios ?? []).map((s) => s.id)
  );

  return computeKpisFromSocios(socios ?? [], memMap, boxConfig.timezone);
}

export function computeKpisFromSocios(
  socios: Array<{ id: string; estado_cuenta: AccountStatus }>,
  memMap: Map<string, MembresiaWithPlan>,
  timezone: string
) {
  let activos = 0;
  let vencidos = 0;
  let pendientes = 0;

  for (const s of socios) {
    const mem = memMap.get(s.id) ?? null;
    const displayStatus = getSocioDisplayStatus(s, mem, timezone);

    switch (displayStatus) {
      case "pendiente_pago":
        pendientes++;
        break;
      case "vencida":
      case "sin_membresia":
        vencidos++;
        break;
      default:
        activos++;
    }
  }

  return { activos, vencidos, pendientes, total: socios.length };
}
