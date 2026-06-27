import { createClient } from "@/lib/supabase/server";
import type { ClaseScore } from "@/types/database";

export type ClaseScoreWithProfile = ClaseScore & {
  profile: { id: string; nombre_completo: string; foto_url: string | null } | null;
};

export async function getScoresForClases(
  claseIds: string[]
): Promise<ClaseScoreWithProfile[]> {
  if (claseIds.length === 0) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("clase_scores")
    .select(
      "*, profile:profiles!clase_scores_usuario_id_fkey(id, nombre_completo, foto_url)"
    )
    .in("clase_id", claseIds)
    .order("created_at", { ascending: true });

  return (data ?? []) as ClaseScoreWithProfile[];
}

export async function getScoresByUsuario(
  usuarioId: string
): Promise<ClaseScore[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clase_scores")
    .select("*")
    .eq("usuario_id", usuarioId)
    .order("created_at", { ascending: false });

  return (data ?? []) as ClaseScore[];
}

export function scoresByClaseId(scores: ClaseScore[]): Map<string, ClaseScore> {
  return new Map(scores.map((s) => [s.clase_id, s]));
}
