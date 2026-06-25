import { createClient } from "@/lib/supabase/server";
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

export async function getAlertasMembresia() {
  const supabase = await createClient();
  const { data: socios } = await supabase
    .from("profiles")
    .select("id, nombre_completo, telefono, user_id, estado_cuenta")
    .eq("rol", "socio");

  if (!socios) return [];

  const alertas: AlertaMembresia[] = [];
  const today = new Date();
  const in3 = new Date();
  in3.setDate(today.getDate() + 3);

  for (const s of socios) {
    const mem = await getMembresiaActual(s.id);
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

export async function getKpis() {
  const supabase = await createClient();
  const { data: socios } = await supabase
    .from("profiles")
    .select("id, estado_cuenta")
    .eq("rol", "socio");

  let activos = 0;
  let vencidos = 0;
  let pendientes = 0;

  for (const s of socios ?? []) {
    if (s.estado_cuenta === "pendiente_pago") {
      pendientes++;
      continue;
    }
    const mem = await getMembresiaActual(s.id);
    if (mem?.estado === "vigente") activos++;
    else vencidos++;
  }

  return { activos, vencidos, pendientes, total: socios?.length ?? 0 };
}

export async function getCoaches(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .in("rol", ["admin", "coach"])
    .order("nombre_completo");
  return data ?? [];
}
