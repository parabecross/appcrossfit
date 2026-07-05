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

/** Bonus de ranking al marcar un skill como dominado (además del logrado). */
export function skillDominadoBadgeKey(skillKey: string): string {
  return `skill_${skillKey}_dominado`;
}

export type SkillRankingSyncAction = {
  badgeKey: string;
  action: "award" | "revoke";
};

/** Qué eventos de ranking otorgar/revocar al cambiar estado de un skill. */
export function resolveSkillRankingSync(
  skillKey: string,
  previous: SkillEstado | null,
  next: SkillEstado | "none"
): SkillRankingSyncAction[] {
  const logradoBadge = skillBadgeKey(skillKey);
  const dominadoBadge = skillDominadoBadgeKey(skillKey);

  const hadLogrado =
    previous === "logrado" || previous === "dominado";
  const hadDominado = previous === "dominado";
  const hasLogrado = next === "logrado" || next === "dominado";
  const hasDominado = next === "dominado";

  const actions: SkillRankingSyncAction[] = [];

  if (hasLogrado && !hadLogrado) {
    actions.push({ badgeKey: logradoBadge, action: "award" });
  }
  if (!hasLogrado && hadLogrado) {
    actions.push({ badgeKey: logradoBadge, action: "revoke" });
  }
  if (hasDominado && !hadDominado) {
    actions.push({ badgeKey: dominadoBadge, action: "award" });
  }
  if (!hasDominado && hadDominado) {
    actions.push({ badgeKey: dominadoBadge, action: "revoke" });
  }

  return actions;
}

/** @deprecated Los logros PR se revocan vía /api/ranking/revoke-pr-achievements */
export function badgeKeysToRevokeAfterPrDelete(
  remainingMarcas: AtletaPrMarca[]
): string[] {
  if (remainingMarcas.length === 0) {
    return ["primer_pr"];
  }
  return [];
}
