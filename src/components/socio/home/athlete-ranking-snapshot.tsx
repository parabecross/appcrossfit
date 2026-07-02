"use client";

import { useTranslations } from "next-intl";
import { Flame, Trophy, TrendingUp, Zap } from "lucide-react";
import { Link } from "@/i18n/routing";
import type { UserAthronSummary } from "@/lib/ranking/aggregate";

export function AthleteRankingSnapshot({
  summary,
  locale,
  enabled,
  boxSlug,
}: {
  summary: UserAthronSummary | null;
  locale: string;
  enabled: boolean;
  boxSlug: string;
}) {
  const t = useTranslations("socioHome.ranking");
  const tr = useTranslations("rankingAthron");
  const tl = useTranslations("legacy");

  if (!enabled || !summary) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-card/30 p-5 text-center">
        <Trophy className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
      </div>
    );
  }

  const rankLabel =
    summary.month_rank != null
      ? t("rankPosition", { rank: summary.month_rank })
      : t("rankPending");

  return (
    <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/[0.1] via-card/50 to-transparent p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-orange-400" />
          <p className="text-sm font-bold">{t("title")}</p>
        </div>
        {summary.streak > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-semibold text-orange-300">
            <Flame className="h-3.5 w-3.5" />
            {t("streak", { days: summary.streak })}
          </span>
        )}
      </div>

      <p className="text-2xl md:text-3xl font-black brand-text leading-none">
        {rankLabel}
      </p>
      <p className="text-sm text-muted-foreground mt-2">
        {t("monthPoints", { points: summary.month_points })}
        {summary.today_points > 0 && (
          <span className="text-orange-400/90">
            {" "}
            · +{summary.today_points} {tr("todayPoints").toLowerCase()}
          </span>
        )}
      </p>

      {summary.category && (
        <p className="text-xs text-muted-foreground mt-3">
          {tr("yourCategory")}: {tl(`levels.${summary.category}`)}
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white/5 px-2 py-2.5 text-center">
          <p className="text-lg font-black tabular-nums text-orange-300">
            {summary.month_points}
          </p>
          <p className="text-[9px] uppercase text-muted-foreground mt-0.5">
            <Zap className="h-3 w-3 inline mr-0.5" />
            {tr("points")}
          </p>
        </div>
        <div className="rounded-xl bg-white/5 px-2 py-2.5 text-center">
          <p className="text-lg font-black tabular-nums">
            {summary.attendances}
          </p>
          <p className="text-[9px] uppercase text-muted-foreground mt-0.5">
            {tr("attendancesShort")}
          </p>
        </div>
        <div className="rounded-xl bg-white/5 px-2 py-2.5 text-center">
          <p className="text-lg font-black tabular-nums">{summary.streak}</p>
          <p className="text-[9px] uppercase text-muted-foreground mt-0.5">
            {tr("streak")}
          </p>
        </div>
      </div>

      <Link
        href={`/ranking?box=${encodeURIComponent(boxSlug)}`}
        locale={locale}
        className="mt-4 block text-center text-xs font-semibold text-orange-400 hover:text-orange-300"
      >
        {tr("viewFullRanking")} →
      </Link>
    </div>
  );
}
