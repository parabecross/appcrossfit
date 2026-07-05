"use client";

import { useTranslations } from "next-intl";
import {
  Flame,
  Minus,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import type { UserAthronSummary } from "@/lib/ranking/aggregate";
import { cn } from "@/lib/utils";

export function ProgressRankingCard({
  summary,
  locale,
  boxSlug,
}: {
  summary: UserAthronSummary;
  locale: string;
  boxSlug?: string;
}) {
  const t = useTranslations("progress.expediente");
  const tr = useTranslations("rankingAthron");
  const tl = useTranslations("legacy");

  const rankingHref = boxSlug
    ? `/ranking?box=${encodeURIComponent(boxSlug)}`
    : "/ranking";

  const progressPct =
    summary.month_rank === 1 || !summary.points_to_next
      ? 100
      : Math.min(
          100,
          Math.round(
            (summary.month_points /
              (summary.month_points + summary.points_to_next)) *
              100
          )
        );

  return (
    <section className="rounded-xl border border-orange-500/25 bg-gradient-to-br from-orange-500/12 to-transparent p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Trophy className="h-3.5 w-3.5 text-orange-400 shrink-0" />
          <p className="text-xs font-bold truncate">{tr("yourRanking")}</p>
        </div>
        {summary.category && (
          <span className="shrink-0 text-[10px] text-muted-foreground truncate max-w-[40%]">
            {tl(`levels.${summary.category}`)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-2xl font-black tabular-nums leading-none">
            {summary.month_rank ?? "—"}
          </p>
          <p className="text-[9px] text-muted-foreground uppercase mt-1">
            {tr("rank")}
          </p>
        </div>
        <div>
          <p className="text-2xl font-black text-orange-300 tabular-nums leading-none">
            {summary.month_points}
          </p>
          <p className="text-[9px] text-muted-foreground uppercase mt-1">
            {tr("points")}
          </p>
        </div>
        <div>
          <WeekRankDelta delta={summary.week_rank_delta} />
          <p className="text-[9px] text-muted-foreground uppercase mt-1">
            {t("weekChange")}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground tabular-nums">
        <span className="inline-flex items-center gap-1">
          <Zap className="h-3 w-3 text-orange-400" />
          {summary.today_points} {tr("todayPoints").toLowerCase()}
        </span>
        <span className="inline-flex items-center gap-1">
          <Flame className="h-3 w-3 text-orange-400" />
          {summary.streak} {tr("streak").toLowerCase()}
        </span>
      </div>

      {summary.month_rank === 1 ? (
        <p className="text-[11px] font-semibold text-orange-300 text-center">
          {t("rankLeader")}
        </p>
      ) : summary.points_to_next && summary.next_rank ? (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            {t("pointsToNext", {
              points: summary.points_to_next,
              rank: summary.next_rank,
            })}
          </p>
        </div>
      ) : summary.month_rank === null ? (
        <p className="text-[10px] text-muted-foreground text-center">
          {t("rankPending")}
        </p>
      ) : null}

      {summary.rank_delta !== null && summary.rank_delta !== 0 && (
        <p className="text-[10px] text-center text-muted-foreground">
          {summary.rank_delta > 0
            ? t("dayRankUp", { delta: summary.rank_delta })
            : t("dayRankDown", { delta: Math.abs(summary.rank_delta) })}
        </p>
      )}

      <Link
        href={rankingHref}
        locale={locale}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center text-[11px] font-semibold text-orange-400 hover:text-orange-300"
      >
        {tr("viewFullRanking")} →
      </Link>
    </section>
  );
}

function WeekRankDelta({ delta }: { delta: number | null }) {
  const t = useTranslations("progress.expediente");

  if (delta === null || delta === 0) {
    return (
      <div className="flex flex-col items-center">
        <Minus className="h-4 w-4 text-muted-foreground" />
        <span className="sr-only">{t("weekRankSame")}</span>
      </div>
    );
  }

  if (delta > 0) {
    return (
      <p
        className={cn(
          "text-lg font-black tabular-nums leading-none flex items-center justify-center gap-0.5 text-green-400"
        )}
      >
        <TrendingUp className="h-3.5 w-3.5" />+{delta}
      </p>
    );
  }

  return (
    <p
      className={cn(
        "text-lg font-black tabular-nums leading-none flex items-center justify-center gap-0.5 text-red-400"
      )}
    >
      <TrendingDown className="h-3.5 w-3.5" />
      {delta}
    </p>
  );
}
