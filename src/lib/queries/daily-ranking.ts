import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayInTimezone } from "@/lib/clases/helpers";
import { APP_CONFIG } from "@/lib/config/app-config";
import {
  buildRankingByCategory,
  type RankingLevel,
} from "@/lib/scores/helpers";
import type { RankingRow } from "@/lib/scores/helpers";
import type { AthleticLevel, Clase, ClaseScore } from "@/types/database";
import type { ClaseScoreWithProfile } from "@/lib/queries/class-scores";

export type CategoryRankings = Record<RankingLevel, RankingRow[]> & {
  uncategorized: RankingRow[];
};

export type WodRankingBlock = {
  clase: Clase;
  categories: CategoryRankings;
  totalScores: number;
};

export type DailyRankingData = {
  box: { id: string; name: string; slug: string; logo_url: string | null };
  date: string;
  todayDate: string;
  isToday: boolean;
  wods: WodRankingBlock[];
};

type AdminClient = ReturnType<typeof createAdminClient>;

async function enrichScoresWithLegacyLevel(
  scores: ClaseScoreWithProfile[],
  admin: AdminClient
): Promise<(ClaseScoreWithProfile & { nivel_deportivo: AthleticLevel | null })[]> {
  if (scores.length === 0) return [];

  const userIds = Array.from(new Set(scores.map((s) => s.usuario_id)));
  const { data: perfiles } = await admin
    .from("atleta_perfil_deportivo")
    .select("usuario_id, nivel_deportivo")
    .in("usuario_id", userIds);

  const nivelMap = new Map(
    (perfiles ?? []).map((p) => [
      p.usuario_id,
      p.nivel_deportivo as AthleticLevel | null,
    ])
  );

  return scores.map((s) => ({
    ...s,
    nivel_deportivo: nivelMap.get(s.usuario_id) ?? null,
  }));
}

async function findLatestDateWithScores(
  admin: AdminClient,
  staffIds: string[],
  onOrBefore: string
): Promise<string | null> {
  const { data: clases } = await admin
    .from("clases")
    .select("fecha, clase_scores!inner(sin_score)")
    .in("coach_id", staffIds)
    .eq("estado", "programada")
    .eq("clase_scores.sin_score", false)
    .lte("fecha", onOrBefore)
    .order("fecha", { ascending: false })
    .limit(40);

  for (const row of clases ?? []) {
    if (row.fecha) return row.fecha as string;
  }

  return null;
}

async function loadRankingForDate(
  admin: AdminClient,
  staffIds: string[],
  date: string
): Promise<WodRankingBlock[]> {
  const { data: clases } = await admin
    .from("clases")
    .select("*")
    .eq("fecha", date)
    .eq("estado", "programada")
    .in("coach_id", staffIds)
    .order("hora_inicio");

  if (!clases?.length) return [];

  const claseIds = clases.map((c) => c.id);
  const { data: rawScores } = await admin
    .from("clase_scores")
    .select(
      "*, profile:profiles!clase_scores_usuario_id_fkey(id, nombre_completo, foto_url)"
    )
    .in("clase_id", claseIds);

  const scores = await enrichScoresWithLegacyLevel(
    (rawScores ?? []) as ClaseScoreWithProfile[],
    admin
  );

  return clases
    .map((clase) => {
      const claseScores = scores.filter(
        (s) => s.clase_id === clase.id && !s.sin_score
      );
      const categories = buildRankingByCategory(claseScores);
      return {
        clase: clase as Clase,
        categories,
        totalScores: claseScores.length,
      };
    })
    .filter((w) => w.totalScores > 0);
}

export async function getDailyRankingForBox(
  boxSlug: string,
  fecha?: string
): Promise<DailyRankingData | null> {
  const admin = createAdminClient();
  const { data: box } = await admin
    .from("boxes")
    .select("id, name, slug, logo_url, timezone, status")
    .eq("slug", boxSlug)
    .maybeSingle();

  if (!box || box.status !== "active") return null;

  const todayDate = todayInTimezone(box.timezone ?? APP_CONFIG.GYM_TIMEZONE);
  const requestedDate = fecha ?? todayDate;

  const { data: staff } = await admin
    .from("profiles")
    .select("id")
    .eq("box_id", box.id)
    .in("rol", ["coach", "admin", "box_admin"]);

  const staffIds = (staff ?? []).map((s) => s.id);
  const boxInfo = {
    id: box.id,
    name: box.name,
    slug: box.slug,
    logo_url: box.logo_url,
  };

  if (staffIds.length === 0) {
    return {
      box: boxInfo,
      date: requestedDate,
      todayDate,
      isToday: requestedDate === todayDate,
      wods: [],
    };
  }

  let displayDate = requestedDate;
  let wods = await loadRankingForDate(admin, staffIds, displayDate);

  if (wods.length === 0 && !fecha) {
    const latest = await findLatestDateWithScores(
      admin,
      staffIds,
      todayDate
    );
    if (latest && latest !== displayDate) {
      displayDate = latest;
      wods = await loadRankingForDate(admin, staffIds, displayDate);
    }
  }

  return {
    box: boxInfo,
    date: displayDate,
    todayDate,
    isToday: displayDate === todayDate,
    wods,
  };
}

export async function getAthleteLevel(
  usuarioId: string
): Promise<AthleticLevel | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("atleta_perfil_deportivo")
    .select("nivel_deportivo")
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  return (data?.nivel_deportivo as AthleticLevel | null) ?? null;
}

export async function enrichScoresForSocio(
  scores: ClaseScoreWithProfile[]
): Promise<(ClaseScoreWithProfile & { nivel_deportivo: AthleticLevel | null })[]> {
  const admin = createAdminClient();
  return enrichScoresWithLegacyLevel(scores, admin);
}

export type { ClaseScore };
