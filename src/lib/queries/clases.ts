import { createClient } from "@/lib/supabase/server";

export async function getClasesByDateRange(from: string, to: string) {
  const supabase = await createClient();
  const { data: clases } = await supabase
    .from("clases")
    .select("*")
    .gte("fecha", from)
    .lte("fecha", to)
    .order("fecha")
    .order("hora_inicio");

  if (!clases) return [];

  const coachIds = Array.from(
    new Set(clases.map((c) => c.coach_id).filter(Boolean))
  ) as string[];
  let coachMap = new Map<string, string>();

  if (coachIds.length > 0) {
    const { data: coaches } = await supabase
      .from("profiles")
      .select("id, nombre_completo")
      .in("id", coachIds);
    coachMap = new Map(
      (coaches ?? []).map((c) => [c.id, c.nombre_completo])
    );
  }

  const result = await Promise.all(
    clases.map(async (c) => {
      const { count } = await supabase
        .from("reservas")
        .select("*", { count: "exact", head: true })
        .eq("clase_id", c.id)
        .in("estado", ["confirmada", "asistio"]);

      return {
        ...c,
        coach_nombre: c.coach_id
          ? coachMap.get(c.coach_id) ?? null
          : null,
        cupo_ocupado: count ?? 0,
      };
    })
  );

  return result;
}
