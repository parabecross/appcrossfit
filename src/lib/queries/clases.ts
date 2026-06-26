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
  let coachMap = new Map<
    string,
    { nombre_completo: string; foto_url: string | null; bio: string | null }
  >();

  if (coachIds.length > 0) {
    const { data: coaches } = await supabase
      .from("profiles")
      .select("id, nombre_completo, foto_url, bio")
      .in("id", coachIds);
    coachMap = new Map(
      (coaches ?? []).map((c) => [
        c.id,
        {
          nombre_completo: c.nombre_completo,
          foto_url: c.foto_url,
          bio: c.bio,
        },
      ])
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
          ? coachMap.get(c.coach_id)?.nombre_completo ?? null
          : null,
        coach_foto_url: c.coach_id
          ? coachMap.get(c.coach_id)?.foto_url ?? null
          : null,
        coach_bio: c.coach_id
          ? coachMap.get(c.coach_id)?.bio ?? null
          : null,
        cupo_ocupado: count ?? 0,
      };
    })
  );

  return result;
}
