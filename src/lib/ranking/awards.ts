import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AthleticLevel,
  RankingAwardType,
  RankingMonthlyAward,
} from "@/types/database";
import { getAthronRankingForBox } from "./aggregate";
import { RANKING_LEVELS } from "@/lib/scores/helpers";

export type MonthlyAwardResult = RankingMonthlyAward & {
  nombre: string;
  foto_url: string | null;
};

export async function computeMonthlyAwards(params: {
  boxSlug: string;
  monthKey: string;
  category?: AthleticLevel;
  persist?: boolean;
}): Promise<MonthlyAwardResult[]> {
  const admin = createAdminClient();
  const { data: box } = await admin
    .from("boxes")
    .select("id, name, timezone")
    .eq("slug", params.boxSlug)
    .single();

  if (!box) return [];

  const categories = params.category
    ? [params.category]
    : ([...RANKING_LEVELS] as AthleticLevel[]);

  const awards: MonthlyAwardResult[] = [];

  for (const category of categories) {
    const data = await getAthronRankingForBox({
      boxSlug: params.boxSlug,
      monthKey: params.monthKey,
      category,
    });
    if (!data || data.leaderboard.length === 0) continue;

    const champion = data.leaderboard[0];
    awards.push(
      await buildAward(admin, box.id, params.monthKey, category, "champion", champion)
    );

    for (const row of data.leaderboard.slice(0, 3)) {
      awards.push(
        await buildAward(admin, box.id, params.monthKey, category, "top3", row)
      );
    }

    const mostConsistent = [...data.leaderboard].sort(
      (a, b) => b.attendances - a.attendances
    )[0];
    if (mostConsistent) {
      awards.push(
        await buildAward(
          admin,
          box.id,
          params.monthKey,
          category,
          "most_consistent",
          mostConsistent
        )
      );
    }

    const longestStreak = [...data.leaderboard].sort(
      (a, b) => b.streak - a.streak
    )[0];
    if (longestStreak) {
      awards.push(
        await buildAward(
          admin,
          box.id,
          params.monthKey,
          category,
          "longest_streak",
          longestStreak
        )
      );
    }

    const { data: evEvents } = await admin
      .from("ranking_point_events")
      .select("usuario_id, points")
      .eq("box_id", box.id)
      .eq("month_key", params.monthKey)
      .eq("event_type", "evolution");

    const evTotals = new Map<string, number>();
    for (const e of evEvents ?? []) {
      evTotals.set(e.usuario_id, (evTotals.get(e.usuario_id) ?? 0) + e.points);
    }

    let bestEvUser: string | null = null;
    let bestEvPts = 0;
    for (const [uid, pts] of Array.from(evTotals.entries())) {
      if (pts > bestEvPts) {
        bestEvPts = pts;
        bestEvUser = uid;
      }
    }

    if (bestEvUser) {
      const row = data.leaderboard.find((r) => r.usuario_id === bestEvUser);
      if (row) {
        awards.push(
          await buildAward(
            admin,
            box.id,
            params.monthKey,
            category,
            "most_evolution",
            { ...row, total_points: bestEvPts }
          )
        );
      }
    }

    const athleteOfMonth = data.leaderboard.reduce((best, row) => {
      const score = row.total_points + row.attendances * 2;
      const bestScore = best.total_points + best.attendances * 2;
      return score > bestScore ? row : best;
    });
    awards.push(
      await buildAward(
        admin,
        box.id,
        params.monthKey,
        category,
        "athlete_of_month",
        athleteOfMonth
      )
    );
  }

  if (params.persist) {
    for (const a of awards) {
      await admin.from("ranking_monthly_awards").upsert(
        {
          box_id: a.box_id,
          month_key: a.month_key,
          category: a.category,
          award_type: a.award_type,
          usuario_id: a.usuario_id,
          points: a.points,
          metadata: a.metadata,
        },
        { onConflict: "box_id,month_key,category,award_type,usuario_id" }
      );
    }
  }

  return awards;
}

async function buildAward(
  admin: ReturnType<typeof createAdminClient>,
  boxId: string,
  monthKey: string,
  category: AthleticLevel,
  awardType: RankingAwardType,
  row: {
    usuario_id: string;
    nombre: string;
    foto_url: string | null;
    total_points: number;
    attendances: number;
    streak: number;
  }
): Promise<MonthlyAwardResult> {
  return {
    id: crypto.randomUUID(),
    box_id: boxId,
    month_key: monthKey,
    category,
    award_type: awardType,
    usuario_id: row.usuario_id,
    points: row.total_points,
    metadata: {
      attendances: row.attendances,
      streak: row.streak,
    },
    created_at: new Date().toISOString(),
    nombre: row.nombre,
    foto_url: row.foto_url,
  };
}

export async function getStoredMonthlyAwards(
  boxId: string,
  monthKey: string
): Promise<MonthlyAwardResult[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ranking_monthly_awards")
    .select("*")
    .eq("box_id", boxId)
    .eq("month_key", monthKey);

  if (!data?.length) return [];

  const userIds = data.map((a) => a.usuario_id);
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, nombre_completo, foto_url")
    .in("id", userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return data.map((a) => ({
    ...(a as RankingMonthlyAward),
    nombre: profileMap.get(a.usuario_id)?.nombre_completo ?? "—",
    foto_url: profileMap.get(a.usuario_id)?.foto_url ?? null,
  }));
}
