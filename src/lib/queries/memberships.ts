import { createClient } from "@/lib/supabase/server";
import { resolveQueryBoxId } from "@/lib/queries/box-scope";
import type { AlertaMembresia, Profile } from "@/types/database";

export async function getMembresiaActual(profileId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("membresias")
    .select("*, plan:planes(*)")
    .eq("usuario_id", profileId)
    .in("estado", ["vigente", "vencida"])
    .order("fecha_fin", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function getMembresiasMapForUsuarios(usuarioIds: string[]) {
  if (usuarioIds.length === 0) return new Map<string, Awaited<ReturnType<typeof getMembresiaActual>>>();

  const supabase = await createClient();
  const { data } = await supabase
    .from("membresias")
    .select("*, plan:planes(*)")
    .in("usuario_id", usuarioIds)
    .in("estado", ["vigente", "vencida"])
    .order("fecha_fin", { ascending: false });

  const map = new Map<string, NonNullable<typeof data>[number]>();
  for (const m of data ?? []) {
    if (!map.has(m.usuario_id)) {
      map.set(m.usuario_id, m);
    }
  }
  return map;
}

export async function getAlertasMembresia(boxId?: string) {
  const resolvedBoxId = await resolveQueryBoxId(boxId);
  const supabase = await createClient();
  const { data: socios } = await supabase
    .from("profiles")
    .select("id, nombre_completo, telefono, user_id, estado_cuenta")
    .eq("box_id", resolvedBoxId)
    .eq("rol", "socio");

  if (!socios) return [];

  const memMap = await getMembresiasMapForUsuarios(socios.map((s) => s.id));
  const alertas: AlertaMembresia[] = [];
  const today = new Date();
  const in3 = new Date();
  in3.setDate(today.getDate() + 3);

  for (const s of socios) {
    const mem = memMap.get(s.id) ?? null;
    if (!mem || s.estado_cuenta === "pendiente_pago") {
      alertas.push({
        profile_id: s.id,
        nombre_completo: s.nombre_completo,
        telefono: s.telefono,
        user_id: s.user_id,
        plan_nombre: mem?.plan?.nombre ?? null,
        fecha_fin: mem?.fecha_fin ?? null,
        tipo_alerta: "vencida",
      });
      continue;
    }
    const fin = new Date(mem.fecha_fin);
    if (fin < today) {
      alertas.push({
        profile_id: s.id,
        nombre_completo: s.nombre_completo,
        telefono: s.telefono,
        user_id: s.user_id,
        plan_nombre: mem.plan?.nombre ?? null,
        fecha_fin: mem.fecha_fin,
        tipo_alerta: "vencida",
      });
    } else if (fin <= in3) {
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
  const supabase = await createClient();
  const { data: socios } = await supabase
    .from("profiles")
    .select("id, estado_cuenta")
    .eq("box_id", resolvedBoxId)
    .eq("rol", "socio");

  let activos = 0;
  let vencidos = 0;
  let pendientes = 0;

  const memMap = await getMembresiasMapForUsuarios(
    (socios ?? []).map((s) => s.id)
  );
  const today = new Date();

  for (const s of socios ?? []) {
    if (s.estado_cuenta === "pendiente_pago") {
      pendientes++;
      continue;
    }
    const mem = memMap.get(s.id);
    if (!mem) {
      vencidos++;
      continue;
    }
    const fin = new Date(mem.fecha_fin);
    if (fin < today) vencidos++;
    else activos++;
  }

  return { activos, vencidos, pendientes, total: socios?.length ?? 0 };
}

export async function getCoaches(boxId?: string): Promise<Profile[]> {
  const resolvedBoxId = await resolveQueryBoxId(boxId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("box_id", resolvedBoxId)
    .in("rol", ["admin", "coach", "box_admin"])
    .order("nombre_completo");
  return data ?? [];
}
