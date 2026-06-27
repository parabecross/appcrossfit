import type { RankingConfig } from "@/types/database";

export function streakBonusForDay(
  streakDays: number,
  config: RankingConfig
): number {
  if (streakDays < 2) return 0;

  const bonuses = config.streak_bonuses;
  const keys = Object.keys(bonuses)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => b - a);

  for (const threshold of keys) {
    if (streakDays >= threshold) {
      return bonuses[String(threshold)] ?? 0;
    }
  }

  return 0;
}
