import { createAdminClient } from "@/lib/supabase/admin";
import { todayInTimezone } from "@/lib/clases/helpers";
import { computeAttendanceStreak } from "@/lib/progreso/attendance";
import { RANKING_LEVELS } from "@/lib/scores/helpers";
import { getRankingConfig } from "./engine";
import type {
  AthleticLevel,
  Profile,
  RankingPointEvent,
} from "@/types/database";

export type LeaderboardRow = {
  usuario_id: string;
  nombre: string;
  foto_url: string | null;
  category: AthleticLevel | null;
  box_name: string;
  total_points: number;
  attendances: number;
  streak: number;
  rank: number;
  rank_delta: number | null;
};

export type DailyClassResult = {
  clase_id: string;
  clase_nombre: string;
  hora_inicio: string;
  hora_fin: string;
  athletes: {
    usuario_id: string;
    nombre: string;
    foto_url: string | null;
    score_display: string | null;
    rx: boolean;
    wod_rank: number | null;
    day_points: number;
    events: RankingPointEvent[];
  }[];
};

export type DailyHistoryDay = {
  fecha: string;
  total_points: number;
  classes: DailyClassResult[];
};

export type AthronRankingData = {
  box: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    timezone: string;
  };
  config: Awaited<ReturnType<typeof getRankingConfig>>;
  month_key: string;
  category: AthleticLevel;
  leaderboard: LeaderboardRow[];
  daily_history: DailyHistoryDay[];
};

function sumPoints(events: RankingPointEvent[]): number {
  return events.reduce((acc, e) => acc + e.points, 0);
}

function groupByUsuario(events: RankingPointEvent[]) {
  const map = new Map<string, RankingPointEvent[]>();
  for (const e of events) {
    const list = map.get(e.usuario_id) ?? [];
    list.push(e);
    map.set(e.usuario_id, list);
  }
  return map;
}

export async function getAthronRankingForBox(params: {
  boxSlug: string;
  monthKey?: string;
  category?: AthleticLevel;
}): Promise<AthronRankingData | null> {
  const admin = createAdminClient();
  const { data: box } = await admin
    .from("boxes")
    .select("id, name, slug, logo_url, timezone, status")
    .eq("slug", params.boxSlug)
    .maybeSingle();

  if (!box || box.status !== "active") return null;

  const timezone = box.timezone ?? "America/Mexico_City";
  const month_key =
    params.monthKey ?? todayInTimezone(timezone).slice(0, 7);
  const category = params.category ?? "intermediate";
  const config = await getRankingConfig(box.id, admin);

  const { data: events } = await admin
    .from("ranking_point_events")
    .select("*")
    .eq("box_id", box.id)
    .eq("month_key", month_key)
    .order("fecha", { ascending: true });

  const allEvents = (events ?? []) as RankingPointEvent[];
  const userIds = Array.from(new Set(allEvents.map((e) => e.usuario_id)));

  const [{ data: profiles }, { data: perfiles }, { data: asistioReservas }] =
    await Promise.all([
      userIds.length
        ? admin
            .from("profiles")
            .select("id, nombre_completo, foto_url")
            .in("id", userIds)
        : Promise.resolve({ data: [] as Profile[] }),
      userIds.length
        ? admin
            .from("atleta_perfil_deportivo")
            .select("usuario_id, nivel_deportivo")
            .in("usuario_id", userIds)
        : Promise.resolve({ data: [] }),
      admin
        .from("reservas")
        .select(
          "usuario_id, clase:clases!inner(fecha, box_id)"
        )
        .eq("estado", "asistio"),
    ]);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p])
  );
  const levelMap = new Map(
    (perfiles ?? []).map((p) => [p.usuario_id, p.nivel_deportivo])
  );

  const attendanceDatesByUser = new Map<string, string[]>();
  for (const r of asistioReservas ?? []) {
    const clase = r.clase as unknown as {
      fecha: string;
      box_id: string | null;
    } | null;
    if (!clase || clase.box_id !== box.id) continue;
    const list = attendanceDatesByUser.get(r.usuario_id) ?? [];
    list.push(clase.fecha);
    attendanceDatesByUser.set(r.usuario_id, list);
  }

  const today = todayInTimezone(timezone);
  const yesterday = (() => {
    const [y, m, d] = today.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    return dt.toISOString().slice(0, 10);
  })();

  const byUser = groupByUsuario(allEvents);
  const rows: Omit<LeaderboardRow, "rank" | "rank_delta">[] = [];

  for (const [usuarioId, userEvents] of Array.from(byUser.entries())) {
    const level = (levelMap.get(usuarioId) as AthleticLevel | null) ?? null;
    if (level !== category) continue;

    const profile = profileMap.get(usuarioId);
    const attendances = userEvents.filter((e) => e.event_type === "attendance").length;
    const total_points = sumPoints(userEvents);

    if (attendances < config.min_attendances_to_rank) continue;
    if (total_points < config.min_points_to_rank) continue;

    const dates = Array.from(
      new Set(attendanceDatesByUser.get(usuarioId) ?? [])
    );
    const streak = computeAttendanceStreak(dates, today);

    rows.push({
      usuario_id: usuarioId,
      nombre: profile?.nombre_completo ?? "—",
      foto_url: profile?.foto_url ?? null,
      category: level,
      box_name: box.name,
      total_points,
      attendances,
      streak,
    });
  }

  rows.sort((a, b) => b.total_points - a.total_points);
  const leaderboard: LeaderboardRow[] = rows.map((r, i) => ({
    ...r,
    rank: i + 1,
    rank_delta: computeRankDelta(r.usuario_id, allEvents, yesterday, today, category, levelMap),
  }));

  const daily_history = await buildDailyHistory(
    admin,
    box.id,
    month_key,
    category,
    allEvents,
    profileMap,
    levelMap
  );

  return {
    box: {
      id: box.id,
      name: box.name,
      slug: box.slug,
      logo_url: box.logo_url,
      timezone,
    },
    config,
    month_key,
    category,
    leaderboard,
    daily_history,
  };
}

function computeRankDelta(
  usuarioId: string,
  allEvents: RankingPointEvent[],
  yesterday: string,
  today: string,
  category: AthleticLevel,
  levelMap: Map<string, string | null>
): number | null {
  const rankOn = (untilDate: string) => {
    const totals = new Map<string, number>();
    for (const e of allEvents) {
      if (e.fecha > untilDate) continue;
      if (levelMap.get(e.usuario_id) !== category) continue;
      totals.set(e.usuario_id, (totals.get(e.usuario_id) ?? 0) + e.points);
    }
    const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
    const idx = sorted.findIndex(([id]) => id === usuarioId);
    return idx === -1 ? null : idx + 1;
  };

  const rankYesterday = rankOn(yesterday);
  const rankToday = rankOn(today);
  if (rankYesterday === null || rankToday === null) return null;
  return rankYesterday - rankToday;
}

async function buildDailyHistory(
  admin: ReturnType<typeof createAdminClient>,
  boxId: string,
  monthKey: string,
  category: AthleticLevel,
  allEvents: RankingPointEvent[],
  profileMap: Map<string, Pick<Profile, "id" | "nombre_completo" | "foto_url">>,
  levelMap: Map<string, string | null>
): Promise<DailyHistoryDay[]> {
  const monthEvents = allEvents.filter((e) => {
    if (e.month_key !== monthKey) return false;
    return levelMap.get(e.usuario_id) === category;
  });

  const fechas = Array.from(new Set(monthEvents.map((e) => e.fecha))).sort(
    (a, b) => b.localeCompare(a)
  );

  const days: DailyHistoryDay[] = [];

  for (const fecha of fechas) {
    const dayEvents = monthEvents.filter((e) => e.fecha === fecha);
    const claseIds = Array.from(
      new Set(dayEvents.map((e) => e.clase_id).filter(Boolean) as string[])
    );

    const { data: clases } = claseIds.length
      ? await admin
          .from("clases")
          .select("id, nombre, hora_inicio, hora_fin")
          .in("id", claseIds)
          .order("hora_inicio")
      : { data: [] };

    const classes: DailyClassResult[] = [];

    for (const clase of clases ?? []) {
      const classEvents = dayEvents.filter((e) => e.clase_id === clase.id);
      const athleteIds = Array.from(new Set(classEvents.map((e) => e.usuario_id)));

      const athletes = athleteIds.map((uid) => {
        const userEv = classEvents.filter((e) => e.usuario_id === uid);
        const wodEv = userEv.find((e) => e.event_type === "wod_position");
        const meta = wodEv?.metadata as {
          rank?: number;
          score_display?: string;
          rx?: boolean;
        } | undefined;
        const profile = profileMap.get(uid);

        return {
          usuario_id: uid,
          nombre: profile?.nombre_completo ?? "—",
          foto_url: profile?.foto_url ?? null,
          score_display: meta?.score_display ?? null,
          rx: meta?.rx ?? true,
          wod_rank: meta?.rank ?? null,
          day_points: sumPoints(userEv),
          events: userEv,
        };
      });

      athletes.sort((a, b) => b.day_points - a.day_points);

      classes.push({
        clase_id: clase.id,
        clase_nombre: clase.nombre,
        hora_inicio: clase.hora_inicio,
        hora_fin: clase.hora_fin,
        athletes,
      });
    }

    days.push({
      fecha,
      total_points: sumPoints(dayEvents),
      classes,
    });
  }

  return days;
}

export { RANKING_LEVELS };

export type UserAthronSummary = {
  month_points: number;
  month_rank: number | null;
  today_points: number;
  streak: number;
  category: AthleticLevel | null;
  attendances: number;
};

export async function getUserAthronSummary(params: {
  boxId: string;
  boxSlug: string;
  usuarioId: string;
  timezone?: string;
  monthKey?: string;
}): Promise<UserAthronSummary> {
  const admin = createAdminClient();
  const timezone = params.timezone ?? "America/Mexico_City";
  const month_key =
    params.monthKey ?? todayInTimezone(timezone).slice(0, 7);
  const today = todayInTimezone(timezone);

  const [{ data: events }, { data: perfil }, { data: asistioReservas }] =
    await Promise.all([
      admin
        .from("ranking_point_events")
        .select("*")
        .eq("box_id", params.boxId)
        .eq("usuario_id", params.usuarioId)
        .eq("month_key", month_key),
      admin
        .from("atleta_perfil_deportivo")
        .select("nivel_deportivo")
        .eq("usuario_id", params.usuarioId)
        .maybeSingle(),
      admin
        .from("reservas")
        .select(
          "usuario_id, clase:clases!inner(fecha, box_id)"
        )
        .eq("usuario_id", params.usuarioId)
        .eq("estado", "asistio"),
    ]);

  const category = (perfil?.nivel_deportivo as AthleticLevel | null) ?? null;
  const userEvents = (events ?? []) as RankingPointEvent[];
  const month_points = sumPoints(userEvents);
  const today_points = sumPoints(userEvents.filter((e) => e.fecha === today));
  const attendances = userEvents.filter((e) => e.event_type === "attendance").length;

  const dates: string[] = [];
  for (const r of asistioReservas ?? []) {
    const clase = r.clase as unknown as {
      fecha: string;
      box_id: string | null;
    } | null;
    if (!clase || clase.box_id !== params.boxId) continue;
    dates.push(clase.fecha);
  }
  const streak = computeAttendanceStreak(Array.from(new Set(dates)), today);

  let month_rank: number | null = null;
  if (category) {
    const data = await getAthronRankingForBox({
      boxSlug: params.boxSlug,
      monthKey: month_key,
      category,
    });
    if (data) {
      const row = data.leaderboard.find((r) => r.usuario_id === params.usuarioId);
      month_rank = row?.rank ?? null;
    }
  }

  return {
    month_points,
    month_rank,
    today_points,
    streak,
    category,
    attendances,
  };
}
