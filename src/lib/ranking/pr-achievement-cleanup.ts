import {
  evaluateAggregatePrAchievements,
  evaluatePrAchievements,
  idempotencyKeyForAggregate,
  idempotencyKeyForPrimerMovimiento,
  idempotencyKeyForPrMejora,
  PR_ACHIEVEMENT_KEYS,
} from "./pr-achievements";
import { marcaRecordKey, getRecordTipo } from "@/lib/progreso/helpers";
import type { AtletaPrMarca, RankingPointEvent } from "@/types/database";

/** Badge keys de logros PR/RM (+ legacy benchmark). */
export const PR_ACHIEVEMENT_BADGE_KEYS = [
  ...Object.values(PR_ACHIEVEMENT_KEYS),
  "benchmark",
] as const;

export function isPrAchievementEvent(
  event: Pick<RankingPointEvent, "idempotency_key" | "metadata">,
  usuarioId: string
): boolean {
  const badgeKey = (event.metadata as { badge_key?: string })?.badge_key;
  if (
    badgeKey &&
    PR_ACHIEVEMENT_BADGE_KEYS.includes(
      badgeKey as (typeof PR_ACHIEVEMENT_BADGE_KEYS)[number]
    )
  ) {
    return true;
  }

  const key = event.idempotency_key;
  if (key === `achievement:${usuarioId}:benchmark`) return true;
  if (key === `achievement:${usuarioId}:${PR_ACHIEVEMENT_KEYS.primer_pr}`) {
    return true;
  }
  if (key === `achievement:${usuarioId}:${PR_ACHIEVEMENT_KEYS.pr_hunter}`) {
    return true;
  }
  if (key.startsWith(`achievement:mejora:${usuarioId}:`)) return true;
  if (key.startsWith(`achievement:marca:`)) return true;
  if (key.startsWith(`achievement:${usuarioId}:primer_mov:`)) return true;
  if (key.startsWith(`achievement:${usuarioId}:racha_mejoras_mes:`)) return true;
  if (key.startsWith(`achievement:${usuarioId}:best_month:`)) return true;

  return false;
}

/** Idempotency keys válidas según marcas actuales del atleta. */
export function buildValidPrIdempotencyKeys(
  marcas: AtletaPrMarca[]
): Set<string> {
  const valid = new Set<string>();
  if (marcas.length === 0) return valid;

  const sorted = [...marcas].sort((a, b) => {
    const byDate = a.fecha.localeCompare(b.fecha);
    if (byDate !== 0) return byDate;
    return a.created_at.localeCompare(b.created_at);
  });

  for (let i = 0; i < sorted.length; i++) {
    const slice = sorted.slice(0, i + 1);
    const marca = sorted[i];
    const awards = evaluatePrAchievements({ marca, allMarcas: slice });
    for (const award of awards) {
      valid.add(award.idempotencyKey);
    }
  }

  const aggregates = evaluateAggregatePrAchievements(
    sorted,
    sorted[0].usuario_id
  );
  for (const award of aggregates) {
    valid.add(award.idempotencyKey);
  }

  return valid;
}

export function orphanMarcaMetadataIds(
  events: Pick<RankingPointEvent, "metadata">[],
  existingMarcaIds: Set<string>
): string[] {
  const orphanIds: string[] = [];
  for (const event of events) {
    const marcaId = (event.metadata as { marca_id?: string })?.marca_id;
    if (marcaId && !existingMarcaIds.has(marcaId)) {
      orphanIds.push(marcaId);
    }
  }
  return orphanIds;
}

export function idempotencyKeysForDeletedMarcaSnapshot(
  marca: AtletaPrMarca
): string[] {
  const recordKey = marcaRecordKey(
    marca.ejercicio,
    getRecordTipo(marca),
    marca.rm_reps
  );
  return [
    idempotencyKeyForPrMejora(marca.usuario_id, recordKey, marca.valor),
    `achievement:marca:${marca.id}:mejora`,
    `achievement:marca:${marca.id}:comeback`,
    idempotencyKeyForPrimerMovimiento(marca.usuario_id, recordKey),
  ];
}

export function primerPrIdempotencyKey(usuarioId: string): string {
  return idempotencyKeyForAggregate(
    usuarioId,
    PR_ACHIEVEMENT_KEYS.primer_pr
  );
}
