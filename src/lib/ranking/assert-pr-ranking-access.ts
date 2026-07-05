import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileRow = {
  id: string;
  box_id: string | null;
  rol: string;
};

export class RankingAccessError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Valida sesión, box compartido y (opcional) propiedad de la marca. */
export async function assertPrRankingAccess(params: {
  supabase: SupabaseClient;
  caller: ProfileRow;
  targetUsuarioId: string;
  marcaId?: string;
  /** Si false, permite marcaId aunque ya no exista (revoke post-delete). */
  requireMarcaExists?: boolean;
}): Promise<void> {
  if (!params.caller.box_id) {
    throw new RankingAccessError("Forbidden", 403);
  }

  if (params.caller.rol === "socio" && params.caller.id !== params.targetUsuarioId) {
    throw new RankingAccessError("Forbidden", 403);
  }

  const { data: targetProfile, error: targetError } = await params.supabase
    .from("profiles")
    .select("id, box_id")
    .eq("id", params.targetUsuarioId)
    .maybeSingle();

  if (targetError || !targetProfile?.box_id) {
    throw new RankingAccessError("Forbidden", 403);
  }

  if (targetProfile.box_id !== params.caller.box_id) {
    throw new RankingAccessError("Forbidden", 403);
  }

  if (params.marcaId && params.requireMarcaExists !== false) {
    const { data: marca, error: marcaError } = await params.supabase
      .from("atleta_pr_marcas")
      .select("id, usuario_id")
      .eq("id", params.marcaId)
      .maybeSingle();

    if (marcaError || !marca || marca.usuario_id !== params.targetUsuarioId) {
      throw new RankingAccessError("Forbidden", 403);
    }
  }
}
