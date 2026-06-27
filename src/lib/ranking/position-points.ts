import type { RankingConfig } from "@/types/database";

export function pointsForRank(rank: number, config: RankingConfig): number {
  if (rank < 1) return 0;

  const table = config.position_points_table;
  if (rank <= table.length) {
    return table[rank - 1] ?? config.position_points_floor;
  }

  const lastTableRank = table.length;
  const lastTablePoints = table[lastTableRank - 1] ?? 16;
  const extra = rank - lastTableRank;
  const computed =
    lastTablePoints - extra * config.position_points_linear_drop;

  return Math.max(config.position_points_floor, computed);
}
