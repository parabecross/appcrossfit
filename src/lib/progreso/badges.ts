import type {
  AtletaObjetivo,
  AtletaPrMarca,
  AtletaSkill,
  SkillEstado,
} from "@/types/database";
import { SKILL_KEYS, type SkillKey } from "./constants";

export const MILESTONE_BADGE_KEYS = [
  "primer_pr",
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

  const milestoneRules: Record<MilestoneBadgeKey, boolean> = {
    primer_pr: input.marcas.length > 0,
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
