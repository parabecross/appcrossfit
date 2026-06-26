import { createClient } from "@/lib/supabase/server";
import {
  getBoxStaffProfileIds,
  resolveQueryBoxId,
} from "@/lib/queries/box-scope";

export async function getClasesByDateRange(
  from: string,
  to: string,
  boxId?: string
) {
  const resolvedBoxId = await resolveQueryBoxId(boxId);
  const staffIds = await getBoxStaffProfileIds(resolvedBoxId);
  if (staffIds.length === 0) return [];

  const supabase = await createClient();
  const { data: clases } = await supabase
    .from("clases")
    .select("*")
    .gte("fecha", from)
    .lte("fecha", to)
    .in("coach_id", staffIds)
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
      .eq("box_id", resolvedBoxId)
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
      const coach = c.coach_id ? coachMap.get(c.coach_id) : null;
      return {
        ...c,
        coach_nombre: coach?.nombre_completo ?? null,
        coach_foto_url: coach?.foto_url ?? null,
        coach_bio: coach?.bio ?? null,
        cupo_ocupado: 0,
      };
    })
  );

  const claseIds = result.map((c) => c.id);
  if (claseIds.length === 0) return result;

  const { data: cupoRows } = await supabase.rpc("clases_cupo_ocupado", {
    p_clase_ids: claseIds,
  });

  const cupoMap = new Map(
    (cupoRows ?? []).map((row: { clase_id: string; ocupado: number }) => [
      row.clase_id,
      row.ocupado,
    ])
  );

  return result.map((c) => ({
    ...c,
    cupo_ocupado: cupoMap.get(c.id) ?? 0,
  }));
}
