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

/** Parsea "8+12" → valor comparable (más rondas gana; empate por reps). */
export function parseRondasNumeric(input: string): number | null {
  const trimmed = input.trim();
  const plusMatch = trimmed.match(/^(\d+)\s*\+\s*(\d+)$/);
  if (plusMatch) {
    const rounds = parseInt(plusMatch[1], 10);
    const reps = parseInt(plusMatch[2], 10);
    if (Number.isNaN(rounds) || Number.isNaN(reps) || reps >= 100) return null;
    return rounds * 100 + reps;
  }
  const roundsOnly = trimmed.match(/^(\d+)$/);
  if (roundsOnly) {
    const rounds = parseInt(roundsOnly[1], 10);
    return Number.isNaN(rounds) ? null : rounds * 100;
  }
  return null;
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
    case "rondas":
      return parseRondasNumeric(trimmed);
    case "peso":
    case "reps":
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

/** RX/Scaled aplica a pesos del WOD; no tiene sentido para calorías. */
export function scoreTypeHasRxScaled(tipo: ClaseScoreTipo): boolean {
  return tipo !== "cals";
}

/**
 * Infere score_tipo desde el texto libre del WOD (`clases.entrenamiento`).
 * No hay metadata estructurada en BD; esto es heurística best-effort.
 * Devuelve null si no hay señal clara (el atleta elige manualmente).
 */
export function inferScoreTipoFromWorkout(
  entrenamiento: string | null | undefined
): ClaseScoreTipo | null {
  if (!entrenamiento?.trim()) return null;
  const text = entrenamiento.toLowerCase();

  // Orden: señales más específicas primero.
  if (
    /\b(amrap|emom)\b/.test(text) ||
    /\brondas?\s*\+?\s*reps?\b/.test(text) ||
    /\brounds?\s*\+?\s*reps?\b/.test(text)
  ) {
    return "rondas";
  }
  if (
    /\bfor\s*time\b/.test(text) ||
    /\bpor\s*tiempo\b/.test(text) ||
    /\btiempo\s*cap\b/.test(text) ||
    /\btime\s*cap\b/.test(text)
  ) {
    return "tiempo";
  }
  if (
    /\b(1\s*rm|1rm|3\s*rm|5\s*rm|max\s*lift|fuerza)\b/.test(text) ||
    /\b(back\s*squat|front\s*squat|deadlift|clean|snatch|thruster|press)\b/.test(
      text
    )
  ) {
    return "peso";
  }
  if (/\b(cal(?:orie)?s?|calor[ií]as?)\b/.test(text)) {
    return "cals";
  }
  if (
    /\b(max\s*reps?|max\s*rep|repeticiones?|reps?\s*for\s*quality)\b/.test(text)
  ) {
    return "reps";
  }

  return null;
}

export type ScoreMode = ClaseScoreTipo | "sin_score";

/** Modo inicial del formulario: score existente > inferencia WOD > tiempo. */
export function resolveInitialScoreMode(
  existing?: Pick<ClaseScore, "sin_score" | "score_tipo"> | null,
  entrenamiento?: string | null
): ScoreMode {
  if (existing?.sin_score) return "sin_score";
  if (existing?.score_tipo && existing.score_tipo !== "otro") {
    return existing.score_tipo;
  }
  return inferScoreTipoFromWorkout(entrenamiento) ?? "tiempo";
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

export const WOD_SCORE_TIPO_ORDER: ClaseScoreTipo[] = [
  "tiempo",
  "peso",
  "reps",
  "rondas",
  "cals",
  "otro",
];

/** Solo compite contra atletas que registraron el mismo tipo de resultado. */
export function filterScoresSameTipo<T extends Pick<ClaseScore, "score_tipo">>(
  scores: T[],
  tipo: ClaseScoreTipo
): T[] {
  return scores.filter((s) => s.score_tipo === tipo);
}

export function groupRankableScoresByTipo(
  scores: ClaseScore[]
): Partial<Record<ClaseScoreTipo, ClaseScore[]>> {
  const grouped: Partial<Record<ClaseScoreTipo, ClaseScore[]>> = {};
  for (const s of scores) {
    if (!canRankScore(s)) continue;
    const list = grouped[s.score_tipo] ?? [];
    list.push(s);
    grouped[s.score_tipo] = list;
  }
  return grouped;
}

export function buildWodRankForAthlete(
  scores: ScoreWithLevel[],
  athleteLevel: RankingLevel | null | undefined,
  athleteUserId: string,
  athleteScoreTipo: ClaseScoreTipo
): RankingRow | null {
  const atLevel = filterScoresByLevel(scores, athleteLevel);
  const sameTipo = filterScoresSameTipo(atLevel, athleteScoreTipo).filter(
    canRankScore
  );
  const ranking = buildClassRanking(sameTipo, athleteUserId);
  return ranking.find((r) => r.score.usuario_id === athleteUserId) ?? null;
}

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
