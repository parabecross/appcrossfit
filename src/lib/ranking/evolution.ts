import type { ClaseScore, RankingConfig } from "@/types/database";
import { isLowerBetter } from "@/lib/scores/helpers";

export type EvolutionReason =
  | "first_rx"
  | "personal_best_small"
  | "personal_best_medium"
  | "personal_best_large"
  | "rank_improved_small"
  | "rank_improved_medium"
  | "rank_improved_large";

export type EvolutionAward = {
  reason: EvolutionReason;
  tier: "small" | "medium" | "large";
  points: number;
};

function isBetterScore(
  nuevo: number,
  anterior: number,
  lowerBetter: boolean
): boolean {
  return lowerBetter ? nuevo < anterior : nuevo > anterior;
}

function improvementTier(
  nuevo: number,
  anterior: number,
  lowerBetter: boolean
): "small" | "medium" | "large" | null {
  if (!isBetterScore(nuevo, anterior, lowerBetter)) return null;

  const diff = lowerBetter
    ? (anterior - nuevo) / Math.max(anterior, 1)
    : (nuevo - anterior) / Math.max(anterior, 1);

  if (diff >= 0.15) return "large";
  if (diff >= 0.05) return "medium";
  return "small";
}

export function computeEvolutionAwards(
  score: ClaseScore,
  previousScores: ClaseScore[],
  previousRank: number | null,
  currentRank: number,
  config: RankingConfig
): EvolutionAward[] {
  const awards: EvolutionAward[] = [];
  const bonuses = config.evolution_bonuses;
  const lowerBetter = isLowerBetter(score.score_tipo);

  if (score.rx && !previousScores.some((s) => s.rx)) {
    awards.push({
      reason: "first_rx",
      tier: "small",
      points: bonuses.small,
    });
  }

  const comparable = previousScores.filter(
    (s) =>
      s.score_tipo === score.score_tipo &&
      s.valor_numerico !== null &&
      score.valor_numerico !== null &&
      !s.sin_score
  );

  if (score.valor_numerico !== null && comparable.length > 0) {
    const bestPrev = comparable.reduce((best, s) => {
      const v = s.valor_numerico!;
      if (best === null) return v;
      return isBetterScore(v, best, lowerBetter) ? v : best;
    }, null as number | null);

    if (bestPrev !== null) {
      const tier = improvementTier(
        score.valor_numerico,
        bestPrev,
        lowerBetter
      );
      if (tier) {
        awards.push({
          reason: `personal_best_${tier}` as EvolutionReason,
          tier,
          points: bonuses[tier],
        });
      }
    }
  }

  if (previousRank !== null && currentRank < previousRank) {
    const jump = previousRank - currentRank;
    const tier =
      jump >= 5 ? "large" : jump >= 2 ? "medium" : ("small" as const);
    awards.push({
      reason: `rank_improved_${tier}` as EvolutionReason,
      tier,
      points: bonuses[tier],
    });
  }

  return awards;
}
