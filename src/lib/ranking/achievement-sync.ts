import type { AtletaPrMarca, SkillEstado } from "@/types/database";

export function achievementIdempotencyKey(
  usuarioId: string,
  badgeKey: string
): string {
  return `achievement:${usuarioId}:${badgeKey}`;
}

export function isSkillAchieved(estado: SkillEstado): boolean {
  return estado === "logrado" || estado === "dominado";
}

export function skillBadgeKey(skillKey: string): string {
  return `skill_${skillKey}`;
}

/** Qué insignias de ranking revocar tras borrar una marca PR/RM. */
export function badgeKeysToRevokeAfterPrDelete(
  remainingMarcas: AtletaPrMarca[]
): string[] {
  if (remainingMarcas.length === 0) {
    return ["primer_pr", "benchmark"];
  }
  if (remainingMarcas.length === 1) {
    return ["benchmark"];
  }
  return [];
}
