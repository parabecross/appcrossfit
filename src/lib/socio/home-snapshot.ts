/**
 * Pure helpers for the socio Home snapshots (progress, badges).
 * No Supabase calls — safe for unit tests and client use.
 */

import {
  computeBadges,
  type BadgeInput,
  type BadgeKey,
  type BadgeStatus,
} from "@/lib/progreso/badges";
import { getRecordTipo } from "@/lib/progreso/helpers";
import type {
  AtletaPrMarca,
  AtletaSkill,
} from "@/types/database";

export type HomeProgressSnapshot = {
  lastPr: AtletaPrMarca | null;
  lastRm: AtletaPrMarca | null;
  lastSkill: AtletaSkill | null;
  prCount: number;
  skillCount: number;
  badgeCount: number;
  previewBadges: BadgeStatus[];
};

/** Chronological latest marca by fecha then created_at (arrays already sorted desc). */
export function pickLatestByRecordTipo(
  marcas: AtletaPrMarca[],
  tipo: "pr" | "rm"
): AtletaPrMarca | null {
  for (const m of marcas) {
    if (getRecordTipo(m) === tipo) return m;
  }
  return null;
}

/**
 * Preview badges: up to 3 unlocked, preferring milestone order from computeBadges
 * (product importance order), which is the existing convention in ProgressBadgesSummary.
 */
export function pickPreviewBadges(
  badges: BadgeStatus[],
  limit = 3
): BadgeStatus[] {
  return badges.filter((b) => b.unlocked).slice(0, limit);
}

export function buildHomeProgressSnapshot(
  marcas: AtletaPrMarca[],
  skills: AtletaSkill[],
  badgeInput: BadgeInput
): HomeProgressSnapshot {
  const badges = computeBadges(badgeInput);
  return {
    lastPr: pickLatestByRecordTipo(marcas, "pr"),
    lastRm: pickLatestByRecordTipo(marcas, "rm"),
    lastSkill: skills[0] ?? null,
    prCount: marcas.filter((m) => getRecordTipo(m) === "pr").length,
    skillCount: skills.filter(
      (s) => s.estado === "logrado" || s.estado === "dominado"
    ).length,
    badgeCount: badges.filter((b) => b.unlocked).length,
    previewBadges: pickPreviewBadges(badges, 3),
  };
}

export function hasTrainingToday(
  nextClassFecha: string | null,
  today: string
): boolean {
  return nextClassFecha === today;
}

/**
 * Single source of truth for header context + next-class visibility.
 * Driven by the same next upcoming booking used for “Próxima clase”.
 */
export type HomeBookingContext = "today" | "upcoming" | "none";

export function resolveHomeBookingContext(
  nextClassFecha: string | null,
  today: string
): HomeBookingContext {
  if (!nextClassFecha) return "none";
  if (nextClassFecha === today) return "today";
  return "upcoming";
}

export function greetingPeriodFromHour(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 19) return "afternoon";
  return "evening";
}

export function hourInTimezone(timeZone: string, now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  return Number(parts.find((p) => p.type === "hour")?.value ?? "12");
}

export type ShareAchievementPayload = {
  title: string;
  text: string;
};

export function buildShareText(payload: ShareAchievementPayload): string {
  return `${payload.title}\n${payload.text}`.trim();
}

export type { BadgeKey };
