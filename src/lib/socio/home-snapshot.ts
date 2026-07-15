/**
 * Pure helpers for the socio Home snapshots (progress, badges, available classes).
 * No Supabase calls — safe for unit tests and client use.
 */

import {
  canBookClass,
  filterClassesForSocio,
} from "@/lib/clases/helpers";
import {
  computeBadges,
  type BadgeInput,
  type BadgeKey,
  type BadgeStatus,
} from "@/lib/progreso/badges";
import { getRecordTipo } from "@/lib/progreso/helpers";
import { isActiveReserva } from "@/lib/reservas/helpers";
import type {
  AtletaPrMarca,
  AtletaSkill,
  Clase,
  Reserva,
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

export function pickAvailableClassesForHome(
  clases: Clase[],
  reservas: Reserva[],
  profileId: string,
  timeZone: string,
  limit = 5
): Clase[] {
  const booked = new Set(
    reservas
      .filter(
        (r) =>
          r.usuario_id === profileId && isActiveReserva(r.estado)
      )
      .map((r) => r.clase_id)
  );

  return filterClassesForSocio(clases, timeZone)
    .filter((c) => !booked.has(c.id))
    .filter((c) => canBookClass(c.fecha, c.hora_inicio, timeZone))
    .filter((c) => (c.cupo_ocupado ?? 0) < c.cupo_maximo)
    .sort(
      (a, b) =>
        a.fecha.localeCompare(b.fecha) ||
        a.hora_inicio.localeCompare(b.hora_inicio)
    )
    .slice(0, limit);
}

export function hasTrainingToday(
  nextClassFecha: string | null,
  today: string
): boolean {
  return nextClassFecha === today;
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
