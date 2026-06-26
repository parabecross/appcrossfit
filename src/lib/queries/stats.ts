import { createClient } from "@/lib/supabase/server";
import { APP_CONFIG } from "@/lib/config/app-config";
import {
  getBoxProfileIds,
  getBoxStaffProfileIds,
  resolveQueryBoxId,
} from "@/lib/queries/box-scope";

export async function getStatsData(boxId?: string) {
  const resolvedBoxId = await resolveQueryBoxId(boxId);
  const supabase = await createClient();

  const [profileIds, staffIds] = await Promise.all([
    getBoxProfileIds(resolvedBoxId),
    getBoxStaffProfileIds(resolvedBoxId),
  ]);

  if (profileIds.length === 0 && staffIds.length === 0) {
    return { reservas: [], clases: [] };
  }

  const weeksAgo = new Date();
  weeksAgo.setDate(weeksAgo.getDate() - APP_CONFIG.TENDENCIA_SEMANAS * 7);
  const from = weeksAgo.toISOString().split("T")[0];

  const reservasQuery = supabase
    .from("reservas")
    .select(
      "*, clase:clases(*), profile:profiles!reservas_usuario_id_fkey(nombre_completo, id)"
    )
    .gte("created_at", from);

  const clasesQuery = supabase
    .from("clases")
    .select("*")
    .gte("fecha", from);

  const [{ data: reservas }, { data: clases }] = await Promise.all([
    profileIds.length > 0
      ? reservasQuery.in("usuario_id", profileIds)
      : reservasQuery.in("usuario_id", ["00000000-0000-0000-0000-000000000000"]),
    staffIds.length > 0
      ? clasesQuery.in("coach_id", staffIds)
      : clasesQuery.in("coach_id", ["00000000-0000-0000-0000-000000000000"]),
  ]);

  const filteredReservas =
    profileIds.length > 0 ? (reservas ?? []) : [];
  const filteredClases = staffIds.length > 0 ? (clases ?? []) : [];

  return { reservas: filteredReservas, clases: filteredClases };
}

export function computeFrequencyStats(
  reservas: Array<{ estado: string; profile: { id: string; nombre_completo: string } | null }>
) {
  const map = new Map<string, { name: string; count: number }>();
  for (const r of reservas) {
    if (r.estado !== "asistio" || !r.profile) continue;
    const cur = map.get(r.profile.id) ?? {
      name: r.profile.nombre_completo,
      count: 0,
    };
    cur.count++;
    map.set(r.profile.id, cur);
  }
  const weeks = APP_CONFIG.TENDENCIA_SEMANAS;
  return Array.from(map.values())
    .map((v) => ({
      name: v.name.split(" ")[0],
      frequency: +(v.count / weeks).toFixed(1),
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 15);
}

export function computeDemandStats(
  reservas: Array<{
    estado: string;
    clase: { hora_inicio: string; fecha: string } | null;
  }>,
  locale = "es"
) {
  const dayNames =
    locale === "en"
      ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      : ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  const map = new Map<string, number>();
  for (const r of reservas) {
    if (!r.clase || r.estado === "cancelada") continue;
    const d = new Date(r.clase.fecha);
    const day = dayNames[d.getDay()];
    const key = `${day} ${r.clase.hora_inicio.slice(0, 5)}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([slot, count]) => ({ slot, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}

export function computeTrendStats(
  reservas: Array<{
    estado: string;
    clase: { fecha: string } | null;
  }>
) {
  const map = new Map<string, number>();
  for (const r of reservas) {
    if (r.estado !== "asistio" || !r.clase) continue;
    const d = new Date(r.clase.fecha);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay() + 1);
    const key = weekStart.toISOString().split("T")[0];
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([week, attendance]) => ({ week, attendance }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

export function computeOccupancyStats(
  clases: Array<{
    id: string;
    nombre: string;
    fecha: string;
    hora_inicio: string;
    cupo_maximo: number;
  }>,
  reservas: Array<{ clase_id: string; estado: string }>,
  locale = "es"
) {
  const dateLocale = locale === "en" ? "en-US" : "es-MX";

  return clases
    .slice(0, 20)
    .map((c) => {
      const count = reservas.filter(
        (r) =>
          r.clase_id === c.id &&
          ["confirmada", "asistio"].includes(r.estado)
      ).length;
      const dia = new Date(c.fecha).toLocaleDateString(dateLocale, {
        weekday: "short",
        day: "numeric",
      });
      const label = `${c.nombre} · ${dia} ${c.hora_inicio.slice(0, 5)}`;
      return {
        name: label,
        occupancy: Math.round((count / c.cupo_maximo) * 100),
      };
    })
    .filter((x) => x.occupancy > 0)
    .slice(0, 10);
}
