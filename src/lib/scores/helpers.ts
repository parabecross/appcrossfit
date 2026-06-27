import type { ClaseScore, ClaseScoreTipo } from "@/types/database";

/** Convierte mm:ss o hh:mm:ss a segundos */
export function parseTimeToSeconds(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(":").map((p) => p.trim());
  if (parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;

  if (parts.length === 2) {
    const [mm, ss] = parts.map(Number);
    if (ss >= 60) return null;
    return mm * 60 + ss;
  }
  if (parts.length === 3) {
    const [hh, mm, ss] = parts.map(Number);
    if (mm >= 60 || ss >= 60) return null;
    return hh * 3600 + mm * 60 + ss;
  }

  const asNumber = parseFloat(trimmed);
  return Number.isNaN(asNumber) ? null : asNumber;
}

export function parseScoreNumeric(
  tipo: ClaseScoreTipo,
  display: string
): number | null {
  const trimmed = display.trim();
  if (!trimmed) return null;

  switch (tipo) {
    case "tiempo":
      return parseTimeToSeconds(trimmed);
    case "peso":
    case "reps":
    case "rondas":
    case "cals": {
      const match = trimmed.match(/[\d]+(?:[.,]\d+)?/);
      if (!match) return null;
      const n = parseFloat(match[0].replace(",", "."));
      return Number.isNaN(n) || n < 0 ? null : n;
    }
    default:
      return null;
  }
}

export function isLowerBetter(tipo: ClaseScoreTipo): boolean {
  return tipo === "tiempo";
}

export function isScoreSkipped(
  score: Pick<ClaseScore, "sin_score"> | null | undefined
): boolean {
  return score?.sin_score === true;
}

export function hasScoreResponse(
  score: ClaseScore | null | undefined
): boolean {
  return !!score;
}

export function hasLoggedScore(
  score: ClaseScore | null | undefined
): boolean {
  return !!score && !score.sin_score;
}

export function canRankScore(
  score: Pick<ClaseScore, "score_tipo" | "valor_numerico" | "sin_score">
): boolean {
  if (score.sin_score) return false;
  return (
    score.score_tipo !== "otro" &&
    score.valor_numerico !== null &&
    score.valor_numerico >= 0
  );
}

export const RANKING_LEVELS = [
  "beginner",
  "intermediate",
  "advanced",
  "rx",
] as const;

export type RankingLevel = (typeof RANKING_LEVELS)[number];

export type ScoreWithLevel = ClaseScore & {
  profile?: { nombre_completo: string; foto_url?: string | null } | null;
  nivel_deportivo?: RankingLevel | null;
};

export function filterScoresByLevel(
  scores: ScoreWithLevel[],
  level: RankingLevel | null | undefined
): ScoreWithLevel[] {
  if (!level) return scores.filter((s) => !s.nivel_deportivo);
  return scores.filter((s) => s.nivel_deportivo === level);
}

export function buildRankingByCategory(
  scores: ScoreWithLevel[],
  myProfileId?: string
): Record<RankingLevel, RankingRow[]> & { uncategorized: RankingRow[] } {
  const byLevel = {} as Record<RankingLevel, RankingRow[]>;
  for (const level of RANKING_LEVELS) {
    byLevel[level] = buildClassRanking(
      filterScoresByLevel(scores, level),
      myProfileId
    );
  }
  const uncategorized = buildClassRanking(
    scores.filter(
      (s) =>
        !s.nivel_deportivo ||
        !RANKING_LEVELS.includes(s.nivel_deportivo as RankingLevel)
    ),
    myProfileId
  );
  return { ...byLevel, uncategorized };
}

export type RankingRow = {
  rank: number;
  score: ClaseScore;
  nombre: string;
  isMe: boolean;
};

export function buildClassRanking(
  scores: (ClaseScore & { profile?: { nombre_completo: string } | null })[],
  myProfileId?: string
): RankingRow[] {
  const rankable = scores.filter(canRankScore);
  const other = scores.filter((s) => !canRankScore(s));

  rankable.sort((a, b) => {
    const tipo = a.score_tipo;
    const av = a.valor_numerico!;
    const bv = b.valor_numerico!;
    if (isLowerBetter(tipo)) return av - bv;
    return bv - av;
  });

  other.sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const ordered = [...rankable, ...other];
  let rank = 0;
  let lastComparable: number | null = null;
  let lastTipo: ClaseScoreTipo | null = null;

  return ordered.map((score, index) => {
    const comparable = canRankScore(score);
    if (comparable) {
      if (
        lastComparable !== score.valor_numerico ||
        lastTipo !== score.score_tipo
      ) {
        rank = index + 1;
      }
      lastComparable = score.valor_numerico;
      lastTipo = score.score_tipo;
    } else {
      rank = index + 1;
    }

    return {
      rank,
      score,
      nombre: score.profile?.nombre_completo ?? "—",
      isMe: myProfileId ? score.usuario_id === myProfileId : false,
    };
  });
}
