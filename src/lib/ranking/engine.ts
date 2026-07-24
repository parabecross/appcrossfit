import { createAdminClient } from "@/lib/supabase/admin";
import { computeAttendanceStreak } from "@/lib/progreso/attendance";
import {
  canRankScore,
  buildWodRankForAthlete,
  type RankingLevel,
} from "@/lib/scores/helpers";
import type { ClaseScoreWithProfile } from "@/lib/queries/class-scores";
import {
  achievementPointsFor,
  mergeRankingConfig,
  monthKeyFromDate,
} from "./config";
import { computeEvolutionAwards } from "./evolution";
import { pointsForRank } from "./position-points";
import {
  aggregateIdempotencyKeyPrefixes,
  evaluateAggregatePrAchievements,
  evaluatePrAchievements,
  idempotencyKeysForMarca,
  PR_ACHIEVEMENT_KEYS,
  shouldRevokePrimerMovimiento,
  shouldRevokePrimerPr,
} from "./pr-achievements";
import {
  buildValidPrIdempotencyKeys,
  idempotencyKeysForDeletedMarcaSnapshot,
  isPrAchievementEvent,
  primerPrIdempotencyKey,
} from "./pr-achievement-cleanup";
import { streakBonusForDay } from "./streak";
import type { AthleticLevel, AtletaPrMarca, RankingConfig } from "@/types/database";

type AdminClient = ReturnType<typeof createAdminClient>;

const BACKFILL_CONCURRENCY = 5;

async function runWithConcurrencyLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;

  let index = 0;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (index < items.length) {
        const current = index++;
        await fn(items[current]);
      }
    })
  );
}

function groupByUsuarioChronological<T extends { usuario_id: string }>(
  items: T[],
  getDate: (item: T) => string
): T[][] {
  const byUser = new Map<string, T[]>();

  for (const item of items) {
    const bucket = byUser.get(item.usuario_id);
    if (bucket) bucket.push(item);
    else byUser.set(item.usuario_id, [item]);
  }

  return Array.from(byUser.values()).map((group) =>
    [...group].sort((a, b) => getDate(a).localeCompare(getDate(b)))
  );
}

export async function getRankingConfig(
  boxId: string,
  admin?: AdminClient
): Promise<RankingConfig> {
  const client = admin ?? createAdminClient();
  const { data } = await client
    .from("ranking_config")
    .select("*")
    .eq("box_id", boxId)
    .maybeSingle();

  return mergeRankingConfig(boxId, data);
}

type PointEventPayload = {
  box_id: string;
  usuario_id: string;
  month_key: string;
  fecha: string;
  clase_id?: string | null;
  reserva_id?: string | null;
  event_type: string;
  points: number;
  metadata?: Record<string, unknown>;
  idempotency_key: string;
};

async function insertEvent(
  admin: AdminClient,
  event: PointEventPayload
): Promise<boolean> {
  const { error } = await admin.from("ranking_point_events").insert(event);
  if (error?.code === "23505") return false;
  if (error) throw new Error(error.message);
  return true;
}

/** Actualiza puntos si el atleta cambia RX/Scaled o mejora su puesto. */
async function upsertEvent(admin: AdminClient, event: PointEventPayload) {
  const { error } = await admin
    .from("ranking_point_events")
    .upsert(event, { onConflict: "idempotency_key" });
  if (error) throw new Error(error.message);
}

async function getAttendanceDates(
  admin: AdminClient,
  usuarioId: string,
  boxId: string
): Promise<string[]> {
  const { data: reservas } = await admin
    .from("reservas")
    .select("clase:clases!inner(fecha, box_id)")
    .eq("usuario_id", usuarioId)
    .eq("estado", "asistio");

  return Array.from(
    new Set(
      (reservas ?? [])
        .filter((r) => {
          const clase = r.clase as unknown as {
            fecha: string;
            box_id: string | null;
          } | null;
          return clase?.box_id === boxId;
        })
        .map((r) => (r.clase as unknown as { fecha: string }).fecha)
    )
  ).sort((a, b) => b.localeCompare(a));
}

export async function awardAttendance(params: {
  reservaId: string;
  admin?: AdminClient;
}): Promise<{ awarded: boolean; events: string[] }> {
  const admin = params.admin ?? createAdminClient();

  const { data: reserva } = await admin
    .from("reservas")
    .select(
      "id, usuario_id, estado, clase:clases!inner(id, fecha, box_id)"
    )
    .eq("id", params.reservaId)
    .single();

  if (!reserva || reserva.estado !== "asistio") {
    return { awarded: false, events: [] };
  }

  const clase = reserva.clase as unknown as {
    id: string;
    fecha: string;
    box_id: string | null;
  };
  if (!clase.box_id) return { awarded: false, events: [] };

  const boxId = clase.box_id;
  const config = await getRankingConfig(boxId, admin);
  if (!config.enabled) return { awarded: false, events: [] };

  const month_key = monthKeyFromDate(clase.fecha);
  const events: string[] = [];

  const attendanceOk = await insertEvent(admin, {
    box_id: boxId,
    usuario_id: reserva.usuario_id,
    month_key,
    fecha: clase.fecha,
    clase_id: clase.id,
    reserva_id: reserva.id,
    event_type: "attendance",
    points: config.attendance_points,
    metadata: { source: "coach_checkin" },
    idempotency_key: `attendance:${reserva.id}`,
  });
  if (attendanceOk) events.push("attendance");

  const dates = await getAttendanceDates(admin, reserva.usuario_id, boxId);
  const streak = computeAttendanceStreak(dates, clase.fecha);
  const streakPts = streakBonusForDay(streak, config);

  if (streakPts > 0) {
    const streakOk = await insertEvent(admin, {
      box_id: boxId,
      usuario_id: reserva.usuario_id,
      month_key,
      fecha: clase.fecha,
      clase_id: clase.id,
      reserva_id: reserva.id,
      event_type: "streak",
      points: streakPts,
      metadata: { streak_days: streak },
      idempotency_key: `streak:${reserva.usuario_id}:${clase.fecha}`,
    });
    if (streakOk) events.push("streak");
  }

  return { awarded: events.length > 0, events };
}

/** Elimina puntos de asistencia/WOD ligados a una reserva y recalcula rachas del atleta. */
export async function revokeAttendanceRanking(params: {
  reservaId: string;
  admin?: AdminClient;
}): Promise<{ revoked: boolean; eventsRemoved: number }> {
  const admin = params.admin ?? createAdminClient();

  const { data: reserva } = await admin
    .from("reservas")
    .select(
      "id, usuario_id, estado, clase:clases!inner(id, fecha, box_id)"
    )
    .eq("id", params.reservaId)
    .single();

  if (!reserva) return { revoked: false, eventsRemoved: 0 };

  const clase = reserva.clase as unknown as {
    id: string;
    fecha: string;
    box_id: string | null;
  };
  if (!clase.box_id) return { revoked: false, eventsRemoved: 0 };

  const boxId = clase.box_id;
  const usuarioId = reserva.usuario_id;
  let eventsRemoved = 0;

  const countDeleted = (rows: { id: string }[] | null) => rows?.length ?? 0;

  const { data: byReserva, error: reservaErr } = await admin
    .from("ranking_point_events")
    .delete()
    .eq("reserva_id", params.reservaId)
    .select("id");
  if (reservaErr) throw new Error(reservaErr.message);
  eventsRemoved += countDeleted(byReserva);

  const { data: byWod, error: wodErr } = await admin
    .from("ranking_point_events")
    .delete()
    .eq("clase_id", clase.id)
    .eq("usuario_id", usuarioId)
    .in("event_type", ["wod_position", "evolution"])
    .select("id");
  if (wodErr) throw new Error(wodErr.message);
  eventsRemoved += countDeleted(byWod);

  const { data: streakRows, error: streakDelErr } = await admin
    .from("ranking_point_events")
    .delete()
    .eq("box_id", boxId)
    .eq("usuario_id", usuarioId)
    .eq("event_type", "streak")
    .select("id");
  if (streakDelErr) throw new Error(streakDelErr.message);
  eventsRemoved += countDeleted(streakRows);

  const { data: asistioReservas } = await admin
    .from("reservas")
    .select("id, clase_id, clase:clases!inner(fecha, box_id)")
    .eq("usuario_id", usuarioId)
    .eq("estado", "asistio")
    .eq("clase.box_id", boxId);

  const sorted = [...(asistioReservas ?? [])].sort((a, b) =>
    (a.clase as unknown as { fecha: string }).fecha.localeCompare(
      (b.clase as unknown as { fecha: string }).fecha
    )
  );

  for (const r of sorted) {
    await awardAttendance({ reservaId: r.id, admin });
    // Restaura puntos WOD que este delete pudo haber borrado (línea 253-261)
    // para una clase que sigue marcada "asistió" — sin esto quedan perdidos
    // permanentemente hasta que alguien re-ejecute award-wod manualmente.
    await syncWodRankingForUser({ claseId: r.clase_id, usuarioId, admin });
  }

  return { revoked: true, eventsRemoved };
}

async function clearWodRankingEventsForUser(
  admin: AdminClient,
  claseId: string,
  usuarioId: string
): Promise<number> {
  const { data, error } = await admin
    .from("ranking_point_events")
    .delete()
    .eq("clase_id", claseId)
    .eq("usuario_id", usuarioId)
    .in("event_type", ["wod_position", "evolution"])
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

/** Borra y recalcula puntos WOD de un atleta tras editar su score. */
export async function syncWodRankingForUser(params: {
  claseId: string;
  usuarioId: string;
  admin?: AdminClient;
}): Promise<{ synced: boolean; events: string[]; eventsRemoved: number }> {
  const admin = params.admin ?? createAdminClient();
  const eventsRemoved = await clearWodRankingEventsForUser(
    admin,
    params.claseId,
    params.usuarioId
  );
  const result = await awardWodResult({
    claseId: params.claseId,
    usuarioId: params.usuarioId,
    admin,
  });
  return {
    synced: result.awarded || eventsRemoved > 0,
    events: result.events,
    eventsRemoved,
  };
}

/** Recalcula ranking WOD de toda la clase (todos los atletas afectados). */
export async function syncWodRankingForClass(params: {
  claseId: string;
  admin?: AdminClient;
}): Promise<{ athletes: number; totalEvents: number }> {
  const admin = params.admin ?? createAdminClient();

  const [{ data: reservas }, { data: scores }] = await Promise.all([
    admin
      .from("reservas")
      .select("usuario_id")
      .eq("clase_id", params.claseId)
      .eq("estado", "asistio"),
    admin
      .from("clase_scores")
      .select("usuario_id")
      .eq("clase_id", params.claseId),
  ]);

  const userIds = Array.from(
    new Set([
      ...(reservas ?? []).map((r) => r.usuario_id),
      ...(scores ?? []).map((s) => s.usuario_id),
    ])
  );

  let totalEvents = 0;
  for (const usuarioId of userIds) {
    const result = await syncWodRankingForUser({
      claseId: params.claseId,
      usuarioId,
      admin,
    });
    totalEvents += result.events.length;
  }

  return { athletes: userIds.length, totalEvents };
}

async function enrichScoresWithLevel(
  admin: AdminClient,
  scores: ClaseScoreWithProfile[]
) {
  if (scores.length === 0) return scores;

  const userIds = Array.from(new Set(scores.map((s) => s.usuario_id)));
  const { data: perfiles } = await admin
    .from("atleta_perfil_deportivo")
    .select("usuario_id, nivel_deportivo")
    .in("usuario_id", userIds);

  const nivelMap = new Map(
    (perfiles ?? []).map((p) => [p.usuario_id, p.nivel_deportivo])
  );

  return scores.map((s) => ({
    ...s,
    nivel_deportivo: (nivelMap.get(s.usuario_id) as AthleticLevel | null) ?? null,
  }));
}

export async function awardWodResult(params: {
  claseId: string;
  usuarioId: string;
  admin?: AdminClient;
}): Promise<{ awarded: boolean; events: string[] }> {
  const admin = params.admin ?? createAdminClient();

  const { data: score } = await admin
    .from("clase_scores")
    .select("*, profile:profiles!clase_scores_usuario_id_fkey(id, nombre_completo, foto_url)")
    .eq("clase_id", params.claseId)
    .eq("usuario_id", params.usuarioId)
    .maybeSingle();

  if (!score) {
    return { awarded: false, events: [] };
  }

  const hasSinScore = score.sin_score === true;
  if (hasSinScore || !canRankScore(score)) {
    return { awarded: false, events: [] };
  }

  const { data: reserva } = await admin
    .from("reservas")
    .select("id, estado")
    .eq("clase_id", params.claseId)
    .eq("usuario_id", params.usuarioId)
    .neq("estado", "cancelada")
    .maybeSingle();

  if (!reserva || reserva.estado !== "asistio") {
    return { awarded: false, events: [] };
  }

  const { data: clase } = await admin
    .from("clases")
    .select("id, nombre, fecha, box_id")
    .eq("id", params.claseId)
    .single();

  if (!clase?.box_id) return { awarded: false, events: [] };

  const boxId = clase.box_id;
  const config = await getRankingConfig(boxId, admin);
  if (!config.enabled) return { awarded: false, events: [] };

  const { data: rawScores } = await admin
    .from("clase_scores")
    .select(
      "*, profile:profiles!clase_scores_usuario_id_fkey(id, nombre_completo, foto_url)"
    )
    .eq("clase_id", params.claseId);

  const enriched = await enrichScoresWithLevel(
    admin,
    (rawScores ?? []) as ClaseScoreWithProfile[]
  );

  const { data: perfil } = await admin
    .from("atleta_perfil_deportivo")
    .select("nivel_deportivo")
    .eq("usuario_id", params.usuarioId)
    .maybeSingle();

  const level = (perfil?.nivel_deportivo as RankingLevel | null) ?? null;
  const myRow = buildWodRankForAthlete(
    enriched,
    level,
    params.usuarioId,
    score.score_tipo
  );
  if (!myRow) return { awarded: false, events: [] };

  const month_key = monthKeyFromDate(clase.fecha);
  const events: string[] = [];
  const positionPts = pointsForRank(myRow.rank, config);
  const rxBonus = score.rx ? config.rx_bonus_points : 0;
  const totalWodPts = positionPts + rxBonus;

  await upsertEvent(admin, {
    box_id: boxId,
    usuario_id: params.usuarioId,
    month_key,
    fecha: clase.fecha,
    clase_id: clase.id,
    reserva_id: reserva.id,
    event_type: "wod_position",
    points: totalWodPts,
    metadata: {
      rank: myRow.rank,
      score_display: score.score_display,
      score_tipo: score.score_tipo,
      rx: score.rx,
      position_points: positionPts,
      rx_bonus: rxBonus,
      category: level,
      clase_nombre: clase.nombre,
    },
    idempotency_key: `wod_position:${params.claseId}:${params.usuarioId}`,
  });
  events.push("wod_position");
  if (rxBonus > 0) events.push("rx_bonus");

  const { data: prevClases } = await admin
    .from("clases")
    .select("id, nombre, fecha")
    .eq("box_id", boxId)
    .eq("nombre", clase.nombre)
    .lt("fecha", clase.fecha)
    .order("fecha", { ascending: false })
    .limit(5);

  const prevClaseIds = (prevClases ?? []).map((c) => c.id);
  let previousScores: ClaseScoreWithProfile[] = [];
  let previousRank: number | null = null;

  if (prevClaseIds.length > 0) {
    const { data: prevRaw } = await admin
      .from("clase_scores")
      .select("*")
      .eq("usuario_id", params.usuarioId)
      .in("clase_id", prevClaseIds);

    previousScores = (prevRaw ?? []) as ClaseScoreWithProfile[];

    const lastClaseId = prevClaseIds[0];
    const { data: lastClassScores } = await admin
      .from("clase_scores")
      .select(
        "*, profile:profiles!clase_scores_usuario_id_fkey(id, nombre_completo, foto_url)"
      )
      .eq("clase_id", lastClaseId);

    const lastEnriched = await enrichScoresWithLevel(
      admin,
      (lastClassScores ?? []) as ClaseScoreWithProfile[]
    );
    const lastRow = buildWodRankForAthlete(
      lastEnriched,
      level,
      params.usuarioId,
      score.score_tipo
    );
    previousRank = lastRow?.rank ?? null;
  }

  const evolutionAwards = hasSinScore
    ? []
    : computeEvolutionAwards(
        score,
        previousScores,
        previousRank,
        myRow.rank,
        config
      );

  for (const award of evolutionAwards) {
    const evOk = await insertEvent(admin, {
      box_id: boxId,
      usuario_id: params.usuarioId,
      month_key,
      fecha: clase.fecha,
      clase_id: clase.id,
      reserva_id: reserva.id,
      event_type: "evolution",
      points: award.points,
      metadata: { reason: award.reason, tier: award.tier },
      idempotency_key: `evolution:${params.claseId}:${params.usuarioId}:${award.reason}`,
    });
    if (evOk) events.push(`evolution:${award.reason}`);
  }

  return { awarded: events.length > 0, events };
}

export async function awardAchievement(params: {
  usuarioId: string;
  boxId: string;
  badgeKey: string;
  fecha?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  points?: number;
  admin?: AdminClient;
}): Promise<{ awarded: boolean }> {
  const admin = params.admin ?? createAdminClient();
  const config = await getRankingConfig(params.boxId, admin);
  if (!config.enabled) return { awarded: false };

  const fecha = params.fecha ?? new Date().toISOString().slice(0, 10);
  const month_key = monthKeyFromDate(fecha);
  const points =
    params.points ?? achievementPointsFor(config, params.badgeKey);

  const ok = await insertEvent(admin, {
    box_id: params.boxId,
    usuario_id: params.usuarioId,
    month_key,
    fecha,
    event_type: "achievement",
    points,
    metadata: {
      badge_key: params.badgeKey,
      ...(params.metadata ?? {}),
    },
    idempotency_key:
      params.idempotencyKey ??
      `achievement:${params.usuarioId}:${params.badgeKey}`,
  });

  return { awarded: ok };
}

export async function revokeAchievementByKey(params: {
  idempotencyKey: string;
  admin?: AdminClient;
}): Promise<{ revoked: boolean; eventsRemoved: number }> {
  const admin = params.admin ?? createAdminClient();

  const { data, error } = await admin
    .from("ranking_point_events")
    .delete()
    .eq("idempotency_key", params.idempotencyKey)
    .select("id");

  if (error) throw new Error(error.message);

  return {
    revoked: (data?.length ?? 0) > 0,
    eventsRemoved: data?.length ?? 0,
  };
}

export async function revokeAchievement(params: {
  usuarioId: string;
  badgeKey: string;
  admin?: AdminClient;
}): Promise<{ revoked: boolean; eventsRemoved: number }> {
  return revokeAchievementByKey({
    idempotencyKey: `achievement:${params.usuarioId}:${params.badgeKey}`,
    admin: params.admin,
  });
}

async function deleteEventsByMarcaIdPrefix(
  admin: AdminClient,
  marcaId: string,
  boxId: string
): Promise<number> {
  const { data, error } = await admin
    .from("ranking_point_events")
    .delete()
    .eq("box_id", boxId)
    .like("idempotency_key", `achievement:marca:${marcaId}:%`)
    .select("id");

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

async function deleteEventsByMarcaMetadata(
  admin: AdminClient,
  marcaId: string,
  boxId: string
): Promise<number> {
  const { data, error } = await admin
    .from("ranking_point_events")
    .delete()
    .eq("box_id", boxId)
    .filter("metadata->>marca_id", "eq", marcaId)
    .select("id");

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

async function deleteEventsByIdempotencyKeysForBox(
  admin: AdminClient,
  boxId: string,
  keys: string[]
): Promise<number> {
  if (keys.length === 0) return 0;

  const { data, error } = await admin
    .from("ranking_point_events")
    .delete()
    .eq("box_id", boxId)
    .in("idempotency_key", keys)
    .select("id");

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

async function deleteEventsByIdempotencyKeys(
  admin: AdminClient,
  keys: string[]
): Promise<number> {
  if (keys.length === 0) return 0;

  const { data, error } = await admin
    .from("ranking_point_events")
    .delete()
    .in("idempotency_key", keys)
    .select("id");

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

async function deleteAggregatePrAchievements(
  admin: AdminClient,
  usuarioId: string,
  boxId: string
): Promise<number> {
  const prefixes = aggregateIdempotencyKeyPrefixes(usuarioId);
  let removed = 0;

  for (const prefix of prefixes) {
    if (prefix.endsWith(":")) {
      const { data, error } = await admin
        .from("ranking_point_events")
        .delete()
        .eq("box_id", boxId)
        .like("idempotency_key", `${prefix}%`)
        .select("id");
      if (error) throw new Error(error.message);
      removed += data?.length ?? 0;
    } else {
      const { data, error } = await admin
        .from("ranking_point_events")
        .delete()
        .eq("box_id", boxId)
        .eq("idempotency_key", prefix)
        .select("id");
      if (error) throw new Error(error.message);
      removed += data?.length ?? 0;
    }
  }

  return removed;
}

/**
 * Revoca y re-otorga logros ligados a una marca (uso en UPDATE de valor).
 */
async function syncPrAchievementsForMarca(params: {
  marcaId: string;
  usuarioId: string;
  boxId: string;
  admin?: AdminClient;
}): Promise<{ awarded: string[]; revoked: number }> {
  const admin = params.admin ?? createAdminClient();

  const { data: marca } = await admin
    .from("atleta_pr_marcas")
    .select("*")
    .eq("id", params.marcaId)
    .eq("usuario_id", params.usuarioId)
    .maybeSingle();

  if (!marca) return { awarded: [], revoked: 0 };

  const typedMarca = marca as AtletaPrMarca;
  const keysToClear = idempotencyKeysForMarca(typedMarca);

  let revoked = await deleteEventsByIdempotencyKeysForBox(
    admin,
    params.boxId,
    keysToClear
  );
  revoked += await deleteEventsByMarcaMetadata(
    admin,
    params.marcaId,
    params.boxId
  );
  revoked += await deleteAggregatePrAchievements(
    admin,
    params.usuarioId,
    params.boxId
  );

  const { data: allMarcas } = await admin
    .from("atleta_pr_marcas")
    .select("*")
    .eq("usuario_id", params.usuarioId)
    .order("fecha", { ascending: true });

  const marcas = (allMarcas ?? []) as AtletaPrMarca[];
  const awards = evaluatePrAchievements({
    marca: typedMarca,
    allMarcas: marcas,
  });

  const awarded: string[] = [];
  for (const award of awards) {
    const result = await awardAchievement({
      usuarioId: params.usuarioId,
      boxId: params.boxId,
      badgeKey: award.badgeKey,
      fecha: typedMarca.fecha,
      idempotencyKey: award.idempotencyKey,
      metadata: award.metadata,
      admin,
    });
    if (result.awarded) awarded.push(award.badgeKey);
  }

  await reawardAggregatePrAchievements(
    admin,
    marcas,
    params.usuarioId,
    params.boxId
  );

  return { awarded, revoked };
}

async function reawardAggregatePrAchievements(
  admin: AdminClient,
  remainingMarcas: AtletaPrMarca[],
  usuarioId: string,
  boxId: string
): Promise<void> {
  const aggregateAwards = evaluateAggregatePrAchievements(
    remainingMarcas,
    usuarioId
  );
  for (const award of aggregateAwards) {
    await awardAchievement({
      usuarioId,
      boxId,
      badgeKey: award.badgeKey,
      fecha: remainingMarcas[remainingMarcas.length - 1]?.fecha ?? new Date().toISOString().slice(0, 10),
      idempotencyKey: award.idempotencyKey,
      metadata: award.metadata,
      admin,
    });
  }
}

export async function awardPrAchievements(params: {
  marcaId: string;
  usuarioId: string;
  boxId: string;
  admin?: AdminClient;
}): Promise<{ awarded: string[] }> {
  const admin = params.admin ?? createAdminClient();

  const { data: marca } = await admin
    .from("atleta_pr_marcas")
    .select("*")
    .eq("id", params.marcaId)
    .eq("usuario_id", params.usuarioId)
    .maybeSingle();

  if (!marca) return { awarded: [] };

  const { data: allMarcas } = await admin
    .from("atleta_pr_marcas")
    .select("*")
    .eq("usuario_id", params.usuarioId)
    .order("fecha", { ascending: true });

  const marcas = (allMarcas ?? []) as AtletaPrMarca[];
  const awards = evaluatePrAchievements({
    marca: marca as AtletaPrMarca,
    allMarcas: marcas,
  });

  const awarded: string[] = [];
  for (const award of awards) {
    const result = await awardAchievement({
      usuarioId: params.usuarioId,
      boxId: params.boxId,
      badgeKey: award.badgeKey,
      fecha: (marca as AtletaPrMarca).fecha,
      idempotencyKey: award.idempotencyKey,
      metadata: award.metadata,
      admin,
    });
    if (result.awarded) awarded.push(award.badgeKey);
  }

  return { awarded };
}

/**
 * Reconcilia puntos tras EDITAR una marca existente (mismo id, valor distinto).
 * Revoca eventos ligados a la marca y recalcula agregados antes de re-otorgar.
 */
export async function reconcilePrAchievementsForMarca(params: {
  marcaId: string;
  usuarioId: string;
  boxId: string;
  admin?: AdminClient;
}): Promise<{ awarded: string[]; revoked: number }> {
  return syncPrAchievementsForMarca(params);
}

export async function cleanupOrphanPrRankingEvents(params: {
  usuarioId: string;
  boxId: string;
  admin?: AdminClient;
}): Promise<{ eventsRemoved: number; eventsReawarded: number }> {
  const admin = params.admin ?? createAdminClient();

  const { data: allMarcas } = await admin
    .from("atleta_pr_marcas")
    .select("*")
    .eq("usuario_id", params.usuarioId)
    .order("fecha", { ascending: true });

  const marcas = (allMarcas ?? []) as AtletaPrMarca[];

  const { data: achievementEvents, error: fetchError } = await admin
    .from("ranking_point_events")
    .select("id, idempotency_key, metadata")
    .eq("box_id", params.boxId)
    .eq("usuario_id", params.usuarioId)
    .eq("event_type", "achievement");

  if (fetchError) throw new Error(fetchError.message);

  const prEvents = (achievementEvents ?? []).filter((event) =>
    isPrAchievementEvent(event, params.usuarioId)
  );

  let eventsRemoved = 0;

  if (marcas.length === 0) {
    if (prEvents.length > 0) {
      const { data, error } = await admin
        .from("ranking_point_events")
        .delete()
        .in(
          "id",
          prEvents.map((e) => e.id)
        )
        .select("id");
      if (error) throw new Error(error.message);
      eventsRemoved += data?.length ?? 0;
    }
    return { eventsRemoved, eventsReawarded: 0 };
  }

  const validKeys = buildValidPrIdempotencyKeys(marcas);
  const orphanIds = prEvents
    .filter((event) => !validKeys.has(event.idempotency_key))
    .map((event) => event.id);

  if (orphanIds.length > 0) {
    const { data, error } = await admin
      .from("ranking_point_events")
      .delete()
      .in("id", orphanIds)
      .select("id");
    if (error) throw new Error(error.message);
    eventsRemoved += data?.length ?? 0;
  }

  let eventsReawarded = 0;
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
      const result = await awardAchievement({
        usuarioId: params.usuarioId,
        boxId: params.boxId,
        badgeKey: award.badgeKey,
        fecha: marca.fecha,
        idempotencyKey: award.idempotencyKey,
        metadata: award.metadata,
        admin,
      });
      if (result.awarded) eventsReawarded++;
    }
  }

  await reawardAggregatePrAchievements(
    admin,
    marcas,
    params.usuarioId,
    params.boxId
  );

  return { eventsRemoved, eventsReawarded };
}

export async function revokePrAchievementsByMarcaId(params: {
  marcaId: string;
  usuarioId: string;
  boxId: string;
  marcaSnapshot?: AtletaPrMarca | null;
  admin?: AdminClient;
}): Promise<{ eventsRemoved: number }> {
  const admin = params.admin ?? createAdminClient();
  let eventsRemoved = 0;

  eventsRemoved += await deleteEventsByMarcaMetadata(
    admin,
    params.marcaId,
    params.boxId
  );
  eventsRemoved += await deleteEventsByMarcaIdPrefix(
    admin,
    params.marcaId,
    params.boxId
  );

  if (params.marcaSnapshot) {
    eventsRemoved += await deleteEventsByIdempotencyKeysForBox(
      admin,
      params.boxId,
      idempotencyKeysForDeletedMarcaSnapshot(params.marcaSnapshot)
    );
  }

  const { data: remainingMarcas } = await admin
    .from("atleta_pr_marcas")
    .select("*")
    .eq("usuario_id", params.usuarioId)
    .order("fecha", { ascending: true });

  const remaining = (remainingMarcas ?? []) as AtletaPrMarca[];

  if (shouldRevokePrimerPr(remaining)) {
    eventsRemoved += await deleteEventsByIdempotencyKeysForBox(
      admin,
      params.boxId,
      [
        primerPrIdempotencyKey(params.usuarioId),
        `achievement:${params.usuarioId}:benchmark`,
      ]
    );
  }

  eventsRemoved += await deleteAggregatePrAchievements(
    admin,
    params.usuarioId,
    params.boxId
  );

  await reawardAggregatePrAchievements(
    admin,
    remaining,
    params.usuarioId,
    params.boxId
  );

  const cleanup = await cleanupOrphanPrRankingEvents({
    usuarioId: params.usuarioId,
    boxId: params.boxId,
    admin,
  });

  return { eventsRemoved: eventsRemoved + cleanup.eventsRemoved };
}

export async function revokePrAchievementsForMarca(params: {
  marca: AtletaPrMarca;
  remainingMarcas: AtletaPrMarca[];
  boxId: string;
  admin?: AdminClient;
}): Promise<{ eventsRemoved: number }> {
  const admin = params.admin ?? createAdminClient();
  const { marca, remainingMarcas, boxId } = params;
  const keysToDelete = idempotencyKeysForMarca(marca);

  if (shouldRevokePrimerPr(remainingMarcas)) {
    keysToDelete.push(
      `achievement:${marca.usuario_id}:${PR_ACHIEVEMENT_KEYS.primer_pr}`,
      `achievement:${marca.usuario_id}:benchmark`
    );
  }

  let eventsRemoved = await deleteEventsByIdempotencyKeysForBox(
    admin,
    boxId,
    keysToDelete
  );
  eventsRemoved += await deleteEventsByMarcaMetadata(admin, marca.id, boxId);
  eventsRemoved += await deleteEventsByMarcaIdPrefix(admin, marca.id, boxId);
  eventsRemoved += await deleteAggregatePrAchievements(
    admin,
    marca.usuario_id,
    boxId
  );

  await reawardAggregatePrAchievements(
    admin,
    remainingMarcas,
    marca.usuario_id,
    boxId
  );

  return { eventsRemoved };
}

export async function backfillRankingForBox(
  boxId: string,
  admin?: AdminClient
): Promise<{ attendance: number; wod: number }> {
  const client = admin ?? createAdminClient();

  await client.from("ranking_point_events").delete().eq("box_id", boxId);

  const { data: asistioReservas } = await client
    .from("reservas")
    .select("id, usuario_id, clase:clases!inner(box_id, fecha)")
    .eq("estado", "asistio")
    .eq("clase.box_id", boxId);

  let attendance = 0;
  const reservaGroups = groupByUsuarioChronological(
    asistioReservas ?? [],
    (r) =>
      (r.clase as unknown as { fecha: string }).fecha
  );

  await runWithConcurrencyLimit(
    reservaGroups,
    BACKFILL_CONCURRENCY,
    async (group) => {
      for (const r of group) {
        const result = await awardAttendance({ reservaId: r.id, admin: client });
        if (result.awarded) attendance++;
      }
    }
  );

  const { data: scores } = await client
    .from("clase_scores")
    .select("clase_id, usuario_id, clase:clases!inner(box_id, fecha)")
    .eq("clase.box_id", boxId);

  let wod = 0;
  const scoreGroups = groupByUsuarioChronological(
    scores ?? [],
    (s) =>
      (s.clase as unknown as { fecha: string }).fecha
  );

  await runWithConcurrencyLimit(
    scoreGroups,
    BACKFILL_CONCURRENCY,
    async (group) => {
      for (const s of group) {
        const result = await awardWodResult({
          claseId: s.clase_id,
          usuarioId: s.usuario_id,
          admin: client,
        });
        if (result.awarded) wod++;
      }
    }
  );

  return { attendance, wod };
}
