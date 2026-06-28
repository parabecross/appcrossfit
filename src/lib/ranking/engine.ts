import { createAdminClient } from "@/lib/supabase/admin";
import { computeAttendanceStreak } from "@/lib/progreso/attendance";
import {
  buildRankingByCategory,
  canRankScore,
  type RankingLevel,
} from "@/lib/scores/helpers";
import type { ClaseScoreWithProfile } from "@/lib/queries/class-scores";
import { mergeRankingConfig, monthKeyFromDate } from "./config";
import { computeEvolutionAwards } from "./evolution";
import { pointsForRank } from "./position-points";
import { streakBonusForDay } from "./streak";
import type { AthleticLevel, RankingConfig } from "@/types/database";

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
    .select("clase:clases!inner(fecha, coach:profiles!clases_coach_id_fkey(box_id))")
    .eq("usuario_id", usuarioId)
    .eq("estado", "asistio");

  return Array.from(
    new Set(
      (reservas ?? [])
        .filter((r) => {
          const clase = r.clase as unknown as {
            fecha: string;
            coach: { box_id: string } | null;
          } | null;
          return clase?.coach?.box_id === boxId;
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
      "id, usuario_id, estado, clase:clases!inner(id, fecha, coach:profiles!clases_coach_id_fkey(box_id))"
    )
    .eq("id", params.reservaId)
    .single();

  if (!reserva || reserva.estado !== "asistio") {
    return { awarded: false, events: [] };
  }

  const clase = reserva.clase as unknown as {
    id: string;
    fecha: string;
    coach: { box_id: string };
  };
  const boxId = clase.coach.box_id;
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
  if (!hasSinScore && !canRankScore(score)) {
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
    .select("id, nombre, fecha, coach:profiles!clases_coach_id_fkey(box_id)")
    .eq("id", params.claseId)
    .single();

  if (!clase) return { awarded: false, events: [] };

  const boxId = (clase.coach as unknown as { box_id: string }).box_id;
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

  const categories = buildRankingByCategory(enriched);
  const { data: perfil } = await admin
    .from("atleta_perfil_deportivo")
    .select("nivel_deportivo")
    .eq("usuario_id", params.usuarioId)
    .maybeSingle();

  const level = (perfil?.nivel_deportivo as RankingLevel | null) ?? null;
  const bucket =
    level && level in categories
      ? categories[level as RankingLevel]
      : categories.uncategorized;

  const myRow = bucket.find((r) => r.score.usuario_id === params.usuarioId);
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
    const lastCats = buildRankingByCategory(lastEnriched);
    const lastBucket =
      level && level in lastCats
        ? lastCats[level as RankingLevel]
        : lastCats.uncategorized;
    const lastRow = lastBucket.find(
      (r) => r.score.usuario_id === params.usuarioId
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
  admin?: AdminClient;
}): Promise<{ awarded: boolean }> {
  const admin = params.admin ?? createAdminClient();
  const config = await getRankingConfig(params.boxId, admin);
  if (!config.enabled) return { awarded: false };

  const fecha = params.fecha ?? new Date().toISOString().slice(0, 10);
  const month_key = monthKeyFromDate(fecha);
  const points =
    config.achievement_points[params.badgeKey] ??
    config.achievement_points.primer_pr ??
    15;

  const ok = await insertEvent(admin, {
    box_id: params.boxId,
    usuario_id: params.usuarioId,
    month_key,
    fecha,
    event_type: "achievement",
    points,
    metadata: { badge_key: params.badgeKey },
    idempotency_key: `achievement:${params.usuarioId}:${params.badgeKey}`,
  });

  return { awarded: ok };
}

export async function backfillRankingForBox(
  boxId: string,
  admin?: AdminClient
): Promise<{ attendance: number; wod: number }> {
  const client = admin ?? createAdminClient();

  const { data: staff } = await client
    .from("profiles")
    .select("id")
    .eq("box_id", boxId)
    .in("rol", ["coach", "admin", "box_admin"]);

  const staffIds = (staff ?? []).map((s) => s.id);
  if (staffIds.length === 0) return { attendance: 0, wod: 0 };

  await client.from("ranking_point_events").delete().eq("box_id", boxId);

  const { data: asistioReservas } = await client
    .from("reservas")
    .select("id, usuario_id, clase:clases!inner(coach_id, fecha)")
    .eq("estado", "asistio")
    .in("clase.coach_id", staffIds);

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
    .select("clase_id, usuario_id, clase:clases!inner(coach_id, fecha)")
    .in("clase.coach_id", staffIds);

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
