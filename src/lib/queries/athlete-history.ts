import { createClient } from "@/lib/supabase/server";
import type { Clase, Reserva } from "@/types/database";

export type AthleteClassHistoryItem = Reserva & {
  clase: Clase & { coach_nombre?: string | null };
};

export async function getAthleteClassHistory(
  usuarioId: string,
  boxId: string
): Promise<AthleteClassHistoryItem[]> {
  const supabase = await createClient();
  const { data: reservas } = await supabase
    .from("reservas")
    .select("*, clase:clases(*)")
    .eq("usuario_id", usuarioId)
    .neq("estado", "cancelada")
    .order("created_at", { ascending: false });

  const items = (reservas ?? []).filter(
    (r): r is AthleteClassHistoryItem =>
      !!r.clase && r.clase.box_id === boxId
  );

  if (items.length === 0) return [];

  const coachIds = Array.from(
    new Set(items.map((r) => r.clase.coach_id).filter(Boolean))
  ) as string[];

  const { data: coaches } = await supabase
    .from("profiles")
    .select("id, nombre_completo")
    .eq("box_id", boxId)
    .in("id", coachIds);

  const coachMap = new Map(
    (coaches ?? []).map((c) => [c.id, c.nombre_completo])
  );

  const enriched = items.map((r) => ({
    ...r,
    clase: {
      ...r.clase,
      coach_nombre: r.clase.coach_id
        ? (coachMap.get(r.clase.coach_id) ?? null)
        : null,
    },
  }));

  enriched.sort((a, b) => {
    const dateCmp = b.clase.fecha.localeCompare(a.clase.fecha);
    if (dateCmp !== 0) return dateCmp;
    return b.clase.hora_inicio.localeCompare(a.clase.hora_inicio);
  });

  return enriched;
}
