import type { RankingConfig } from "@/types/database";
import { BADGE_KEYS, type BadgeKey } from "@/lib/progreso/badges";

export const DEFAULT_STREAK_BONUSES: Record<string, number> = {
  "2": 2,
  "3": 4,
  "4": 6,
  "5": 8,
  "6": 10,
  "7": 15,
};

export const DEFAULT_POSITION_TABLE = [30, 28, 26, 24, 22, 20, 19, 18, 17, 16];

export const DEFAULT_EVOLUTION_BONUSES = {
  small: 5,
  medium: 10,
  large: 15,
};

export const DEFAULT_ACHIEVEMENT_POINTS: Record<string, number> = {
  primer_pr: 20,
  siete_dias: 15,
  treinta_dias: 30,
  cien_clases: 50,
  objetivo_cumplido: 25,
  skill_pull_ups: 15,
  skill_chest_to_bar: 15,
  skill_bar_muscle_up: 25,
  skill_ring_muscle_up: 25,
  skill_handstand_push_up: 20,
  skill_handstand_walk: 25,
  skill_double_unders: 15,
  skill_rope_climb: 15,
  skill_pistols: 20,
  skill_kipping_pull_up: 10,
  skill_butterfly_pull_up: 20,
  murph: 30,
  benchmark: 20,
};

export function getDefaultRankingConfig(boxId: string): RankingConfig {
  const achievement_points: Record<string, number> = { ...DEFAULT_ACHIEVEMENT_POINTS };
  for (const key of BADGE_KEYS) {
    if (!(key in achievement_points)) {
      achievement_points[key] = 15;
    }
  }

  return {
    box_id: boxId,
    enabled: true,
    attendance_points: 15,
    streak_bonuses: { ...DEFAULT_STREAK_BONUSES },
    position_points_table: [...DEFAULT_POSITION_TABLE],
    position_points_floor: 5,
    position_points_linear_drop: 1,
    evolution_bonuses: { ...DEFAULT_EVOLUTION_BONUSES },
    achievement_points,
    min_attendances_to_rank: 1,
    min_points_to_rank: 0,
    rx_bonus_points: 5,
    tagline: "La constancia construye campeones.",
    updated_at: new Date().toISOString(),
  };
}

export function mergeRankingConfig(
  boxId: string,
  row: Partial<RankingConfig> | null
): RankingConfig {
  const defaults = getDefaultRankingConfig(boxId);
  if (!row) return defaults;

  return {
    ...defaults,
    ...row,
    streak_bonuses: {
      ...defaults.streak_bonuses,
      ...(row.streak_bonuses as Record<string, number> | undefined),
    },
    evolution_bonuses: {
      ...defaults.evolution_bonuses,
      ...(row.evolution_bonuses as RankingConfig["evolution_bonuses"] | undefined),
    },
    achievement_points: {
      ...defaults.achievement_points,
      ...(row.achievement_points as Record<string, number> | undefined),
    },
    position_points_table:
      Array.isArray(row.position_points_table) && row.position_points_table.length > 0
        ? row.position_points_table
        : defaults.position_points_table,
  };
}

export function monthKeyFromDate(fecha: string): string {
  return fecha.slice(0, 7);
}

export function achievementPointsFor(
  config: RankingConfig,
  key: BadgeKey | string
): number {
  return config.achievement_points[key] ?? DEFAULT_ACHIEVEMENT_POINTS[key] ?? 15;
}
