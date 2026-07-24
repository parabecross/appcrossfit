import type {
  AtletaObjetivo,
  AtletaPrMarca,
  AtletaSkill,
  SkillEstado,
} from "@/types/database";
import { SKILL_KEYS, type SkillKey } from "./constants";
import {
  countComebackImprovements,
  enumeratePrImprovements,
} from "@/lib/ranking/pr-achievements";

export const MILESTONE_BADGE_KEYS = [
  "primer_pr",
  "pr_mejora",
  "pr_hunter",
  "racha_mejoras_mes",
  "comeback_pr",
  "best_month",
  "siete_dias",
  "treinta_dias",
  "cien_clases",
  "objetivo_cumplido",
] as const;

export type MilestoneBadgeKey = (typeof MILESTONE_BADGE_KEYS)[number];

export function skillBadgeKey(skill: SkillKey): `skill_${SkillKey}` {
  return `skill_${skill}`;
}

export const SKILL_BADGE_KEYS = SKILL_KEYS.map(
  (skill) => skillBadgeKey(skill)
);

export const BADGE_KEYS = [
  ...MILESTONE_BADGE_KEYS,
  ...SKILL_BADGE_KEYS,
] as const;

export type BadgeKey = (typeof BADGE_KEYS)[number];

export interface BadgeStatus {
  key: BadgeKey;
  unlocked: boolean;
}

export interface BadgeInput {
  marcas: AtletaPrMarca[];
  skills: AtletaSkill[];
  objetivos: AtletaObjetivo[];
  totalClasses: number;
  uniqueTrainingDays: number;
}

function isSkillAchieved(estado: string): boolean {
  return estado === "logrado" || estado === "dominado";
}

function skillUnlocked(skills: AtletaSkill[], skillKey: SkillKey): boolean {
  const row = skills.find((s) => s.skill === skillKey);
  return row ? isSkillAchieved(row.estado) : false;
}

export function computeBadges(input: BadgeInput): BadgeStatus[] {
  const hasCompletedGoal = input.objetivos.some((o) => o.estado === "completado");
  const improvements = enumeratePrImprovements(input.marcas);
  const byMonth = new Map<string, number>();
  for (const event of improvements) {
    byMonth.set(event.monthKey, (byMonth.get(event.monthKey) ?? 0) + 1);
  }
  const hasRachaMes = Array.from(byMonth.values()).some(
    (count) => count >= 3
  );
  let bestMonthCount = 0;
  for (const count of byMonth.values()) {
    bestMonthCount = Math.max(bestMonthCount, count);
  }

  const milestoneRules: Record<MilestoneBadgeKey, boolean> = {
    primer_pr: input.marcas.length > 0,
    pr_mejora: improvements.length > 0,
    pr_hunter: improvements.length >= 5,
    racha_mejoras_mes: hasRachaMes,
    comeback_pr: countComebackImprovements(input.marcas) > 0,
    best_month: bestMonthCount > 0,
    siete_dias: input.uniqueTrainingDays >= 7,
    treinta_dias: input.uniqueTrainingDays >= 30,
    cien_clases: input.totalClasses >= 100,
    objetivo_cumplido: hasCompletedGoal,
  };

  const milestones: BadgeStatus[] = MILESTONE_BADGE_KEYS.map((key) => ({
    key,
    unlocked: milestoneRules[key],
  }));

  const skillBadges: BadgeStatus[] = SKILL_KEYS.map((skill) => ({
    key: skillBadgeKey(skill),
    unlocked: skillUnlocked(input.skills, skill),
  }));

  return [...milestones, ...skillBadges];
}

export function countUnlockedBadges(badges: BadgeStatus[]): number {
  return badges.filter((b) => b.unlocked).length;
}

export function splitBadges(badges: BadgeStatus[]): {
  milestones: BadgeStatus[];
  skills: BadgeStatus[];
} {
  return {
    milestones: badges.filter((b) => !isSkillBadgeKey(b.key)),
    skills: badges.filter((b) => isSkillBadgeKey(b.key)),
  };
}

export function countUnlockedSkillBadges(badges: BadgeStatus[]): number {
  return badges.filter((b) => isSkillBadgeKey(b.key) && b.unlocked).length;
}

export function getSkillBadgeState(
  skills: AtletaSkill[],
  skillKey: SkillKey
): SkillEstado | null {
  const row = skills.find((s) => s.skill === skillKey);
  return row?.estado ?? null;
}

export function isSkillBadgeKey(key: BadgeKey): key is `skill_${SkillKey}` {
  return key.startsWith("skill_");
}

export function skillKeyFromBadgeKey(key: `skill_${SkillKey}`): SkillKey {
  return key.replace("skill_", "") as SkillKey;
}
