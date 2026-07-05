import { marcaRecordKey, getPreviousPr, getRecordTipo, isPrImprovement } from "@/lib/progreso/helpers";
import type { AtletaPrMarca } from "@/types/database";

/** Claves de logro por progreso en PR/RM (sin pesos fijos). */
export const PR_ACHIEVEMENT_KEYS = {
  primer_pr: "primer_pr",
  primer_movimiento: "primer_movimiento",
  pr_mejora: "pr_mejora",
  racha_mejoras_mes: "racha_mejoras_mes",
  pr_hunter: "pr_hunter",
  comeback_pr: "comeback_pr",
  best_month: "best_month",
} as const;

export type PrAchievementKey =
  (typeof PR_ACHIEVEMENT_KEYS)[keyof typeof PR_ACHIEVEMENT_KEYS];

export type PrAchievementAward = {
  badgeKey: PrAchievementKey;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
};

export type PrImprovementEvent = {
  marca: AtletaPrMarca;
  previous: AtletaPrMarca;
  monthKey: string;
};

const RACHA_IMPROVEMENTS_THRESHOLD = 3;
const PR_HUNTER_THRESHOLD = 5;
const COMEBACK_DAYS = 90;

function monthKeyFromDate(fecha: string): string {
  return fecha.slice(0, 7);
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const start = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  return Math.floor((end - start) / 86_400_000);
}

function marcaSortKey(m: AtletaPrMarca): string {
  return `${m.fecha}\0${m.created_at}\0${m.id}`;
}

/** Mejoras reales: nuevo valor supera el mejor anterior del mismo movimiento/tipo. */
export function enumeratePrImprovements(marcas: AtletaPrMarca[]): PrImprovementEvent[] {
  const sorted = [...marcas].sort((a, b) => marcaSortKey(a).localeCompare(marcaSortKey(b)));
  const events: PrImprovementEvent[] = [];

  for (const marca of sorted) {
    const before = sorted.filter(
      (m) =>
        m.id !== marca.id &&
        marcaSortKey(m).localeCompare(marcaSortKey(marca)) < 0
    );
    const previous = getPreviousPr(
      before,
      marca.ejercicio,
      getRecordTipo(marca),
      marca.rm_reps
    );
    if (!previous) continue;
    if (!isPrImprovement(marca.ejercicio, marca.valor, previous.valor)) continue;

    events.push({
      marca,
      previous,
      monthKey: monthKeyFromDate(marca.fecha),
    });
  }

  return events;
}

export function idempotencyKeyForMarcaAchievement(
  marcaId: string,
  suffix: "mejora" | "comeback"
): string {
  return `achievement:marca:${marcaId}:${suffix}`;
}

/** Evita duplicar puntos al volver al mismo PR (ej. 100→105→95→105). */
export function idempotencyKeyForPrMejora(
  usuarioId: string,
  recordKey: string,
  valor: number
): string {
  return `achievement:mejora:${usuarioId}:${recordKey}:${valor}`;
}

export function idempotencyKeyForPrimerMovimiento(
  usuarioId: string,
  recordKey: string
): string {
  return `achievement:${usuarioId}:primer_mov:${recordKey}`;
}

export function idempotencyKeyForAggregate(
  usuarioId: string,
  badgeKey: PrAchievementKey,
  scope?: string
): string {
  if (scope) return `achievement:${usuarioId}:${badgeKey}:${scope}`;
  return `achievement:${usuarioId}:${badgeKey}`;
}

/** Evalúa qué logros debe recibir una marca recién guardada. */
export function evaluatePrAchievements(params: {
  marca: AtletaPrMarca;
  allMarcas: AtletaPrMarca[];
}): PrAchievementAward[] {
  const { marca, allMarcas } = params;
  const others = allMarcas.filter((m) => m.id !== marca.id);
  const previous = getPreviousPr(
    others,
    marca.ejercicio,
    getRecordTipo(marca),
    marca.rm_reps
  );

  const isFirstEver = others.length === 0;
  const isFirstForMovement = !previous;
  const isImprovement =
    previous !== null &&
    isPrImprovement(marca.ejercicio, marca.valor, previous.valor);

  if (!isFirstForMovement && !isImprovement) {
    return [];
  }

  const awards: PrAchievementAward[] = [];
  const recordKey = marcaRecordKey(
    marca.ejercicio,
    getRecordTipo(marca),
    marca.rm_reps
  );
  const baseMeta = {
    marca_id: marca.id,
    ejercicio: marca.ejercicio,
    record_tipo: getRecordTipo(marca),
    rm_reps: marca.rm_reps,
    valor: marca.valor,
    unidad: marca.unidad,
    fecha: marca.fecha,
  };

  if (isFirstEver) {
    awards.push({
      badgeKey: PR_ACHIEVEMENT_KEYS.primer_pr,
      idempotencyKey: idempotencyKeyForAggregate(marca.usuario_id, PR_ACHIEVEMENT_KEYS.primer_pr),
      metadata: { ...baseMeta, badge_key: PR_ACHIEVEMENT_KEYS.primer_pr },
    });
  }

  if (isFirstForMovement) {
    awards.push({
      badgeKey: PR_ACHIEVEMENT_KEYS.primer_movimiento,
      idempotencyKey: idempotencyKeyForPrimerMovimiento(marca.usuario_id, recordKey),
      metadata: {
        ...baseMeta,
        badge_key: PR_ACHIEVEMENT_KEYS.primer_movimiento,
        record_key: recordKey,
      },
    });
  }

  if (isImprovement && previous) {
    awards.push({
      badgeKey: PR_ACHIEVEMENT_KEYS.pr_mejora,
      idempotencyKey: idempotencyKeyForPrMejora(
        marca.usuario_id,
        recordKey,
        marca.valor
      ),
      metadata: {
        ...baseMeta,
        badge_key: PR_ACHIEVEMENT_KEYS.pr_mejora,
        record_key: recordKey,
        previous_valor: previous.valor,
        previous_unidad: previous.unidad,
        previous_fecha: previous.fecha,
      },
    });

    if (daysBetween(previous.fecha, marca.fecha) >= COMEBACK_DAYS) {
      awards.push({
        badgeKey: PR_ACHIEVEMENT_KEYS.comeback_pr,
        idempotencyKey: idempotencyKeyForMarcaAchievement(marca.id, "comeback"),
        metadata: {
          ...baseMeta,
          badge_key: PR_ACHIEVEMENT_KEYS.comeback_pr,
          previous_valor: previous.valor,
          days_since: daysBetween(previous.fecha, marca.fecha),
        },
      });
    }
  }

  const improvements = enumeratePrImprovements(allMarcas);
  const monthKey = monthKeyFromDate(marca.fecha);
  const improvementsThisMonth = improvements.filter((e) => e.monthKey === monthKey);

  if (improvementsThisMonth.length >= RACHA_IMPROVEMENTS_THRESHOLD) {
    awards.push({
      badgeKey: PR_ACHIEVEMENT_KEYS.racha_mejoras_mes,
      idempotencyKey: idempotencyKeyForAggregate(
        marca.usuario_id,
        PR_ACHIEVEMENT_KEYS.racha_mejoras_mes,
        monthKey
      ),
      metadata: {
        badge_key: PR_ACHIEVEMENT_KEYS.racha_mejoras_mes,
        month_key: monthKey,
        improvements_count: improvementsThisMonth.length,
      },
    });
  }

  if (improvements.length >= PR_HUNTER_THRESHOLD) {
    awards.push({
      badgeKey: PR_ACHIEVEMENT_KEYS.pr_hunter,
      idempotencyKey: idempotencyKeyForAggregate(
        marca.usuario_id,
        PR_ACHIEVEMENT_KEYS.pr_hunter
      ),
      metadata: {
        badge_key: PR_ACHIEVEMENT_KEYS.pr_hunter,
        improvements_count: improvements.length,
      },
    });
  }

  const byMonth = new Map<string, number>();
  for (const event of improvements) {
    byMonth.set(event.monthKey, (byMonth.get(event.monthKey) ?? 0) + 1);
  }
  const currentMonthCount = byMonth.get(monthKey) ?? 0;
  let maxOtherMonth = 0;
  for (const [key, count] of byMonth.entries()) {
    if (key !== monthKey) maxOtherMonth = Math.max(maxOtherMonth, count);
  }

  if (currentMonthCount > maxOtherMonth && currentMonthCount > 0) {
    awards.push({
      badgeKey: PR_ACHIEVEMENT_KEYS.best_month,
      idempotencyKey: idempotencyKeyForAggregate(
        marca.usuario_id,
        PR_ACHIEVEMENT_KEYS.best_month,
        monthKey
      ),
      metadata: {
        badge_key: PR_ACHIEVEMENT_KEYS.best_month,
        month_key: monthKey,
        improvements_count: currentMonthCount,
      },
    });
  }

  return awards;
}

/** Cuenta mejoras con gap >= 90 días respecto al anterior del mismo movimiento. */
export function countComebackImprovements(marcas: AtletaPrMarca[]): number {
  return enumeratePrImprovements(marcas).filter(
    (e) => daysBetween(e.previous.fecha, e.marca.fecha) >= COMEBACK_DAYS
  ).length;
}

/** Idempotency keys ligadas a una marca concreta (para revocar al borrar). */
export function idempotencyKeysForMarca(marca: AtletaPrMarca): string[] {
  const recordKey = marcaRecordKey(
    marca.ejercicio,
    getRecordTipo(marca),
    marca.rm_reps
  );
  return [
    idempotencyKeyForPrMejora(marca.usuario_id, recordKey, marca.valor),
    idempotencyKeyForMarcaAchievement(marca.id, "mejora"),
    idempotencyKeyForMarcaAchievement(marca.id, "comeback"),
    idempotencyKeyForPrimerMovimiento(marca.usuario_id, recordKey),
  ];
}

/** Idempotency keys de logros agregados que deben recalcularse tras un borrado. */
export function aggregateIdempotencyKeyPrefixes(usuarioId: string): string[] {
  return [
    `achievement:${usuarioId}:${PR_ACHIEVEMENT_KEYS.pr_hunter}`,
    `achievement:${usuarioId}:${PR_ACHIEVEMENT_KEYS.racha_mejoras_mes}:`,
    `achievement:${usuarioId}:${PR_ACHIEVEMENT_KEYS.best_month}:`,
  ];
}

export function shouldRevokePrimerPr(remainingMarcas: AtletaPrMarca[]): boolean {
  return remainingMarcas.length === 0;
}

export function shouldRevokePrimerMovimiento(
  deletedMarca: AtletaPrMarca,
  remainingMarcas: AtletaPrMarca[]
): boolean {
  const recordKey = marcaRecordKey(
    deletedMarca.ejercicio,
    getRecordTipo(deletedMarca),
    deletedMarca.rm_reps
  );
  return !remainingMarcas.some(
    (m) =>
      marcaRecordKey(m.ejercicio, getRecordTipo(m), m.rm_reps) === recordKey
  );
}

/** Re-evalúa logros agregados tras borrar una marca. */
export function evaluateAggregatePrAchievements(
  allMarcas: AtletaPrMarca[],
  usuarioId: string
): PrAchievementAward[] {
  if (allMarcas.length === 0) return [];

  const improvements = enumeratePrImprovements(allMarcas);
  const awards: PrAchievementAward[] = [];

  const byMonth = new Map<string, number>();
  for (const event of improvements) {
    byMonth.set(event.monthKey, (byMonth.get(event.monthKey) ?? 0) + 1);
  }

  for (const [monthKey, count] of byMonth.entries()) {
    if (count >= RACHA_IMPROVEMENTS_THRESHOLD) {
      awards.push({
        badgeKey: PR_ACHIEVEMENT_KEYS.racha_mejoras_mes,
        idempotencyKey: idempotencyKeyForAggregate(
          usuarioId,
          PR_ACHIEVEMENT_KEYS.racha_mejoras_mes,
          monthKey
        ),
        metadata: {
          badge_key: PR_ACHIEVEMENT_KEYS.racha_mejoras_mes,
          month_key: monthKey,
          improvements_count: count,
        },
      });
    }
  }

  if (improvements.length >= PR_HUNTER_THRESHOLD) {
    awards.push({
      badgeKey: PR_ACHIEVEMENT_KEYS.pr_hunter,
      idempotencyKey: idempotencyKeyForAggregate(
        usuarioId,
        PR_ACHIEVEMENT_KEYS.pr_hunter
      ),
      metadata: {
        badge_key: PR_ACHIEVEMENT_KEYS.pr_hunter,
        improvements_count: improvements.length,
      },
    });
  }

  let bestMonth: { monthKey: string; count: number } | null = null;
  for (const [monthKey, count] of byMonth.entries()) {
    if (!bestMonth || count > bestMonth.count) {
      bestMonth = { monthKey, count };
    }
  }

  if (bestMonth && bestMonth.count > 0) {
    awards.push({
      badgeKey: PR_ACHIEVEMENT_KEYS.best_month,
      idempotencyKey: idempotencyKeyForAggregate(
        usuarioId,
        PR_ACHIEVEMENT_KEYS.best_month,
        bestMonth.monthKey
      ),
      metadata: {
        badge_key: PR_ACHIEVEMENT_KEYS.best_month,
        month_key: bestMonth.monthKey,
        improvements_count: bestMonth.count,
      },
    });
  }

  return awards;
}
