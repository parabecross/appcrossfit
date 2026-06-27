"use client";

import { useTranslations } from "next-intl";
import { Flame, Trophy, Zap } from "lucide-react";
import { Link } from "@/i18n/routing";

export function AthronPointsWidget({
  monthPoints,
  todayPoints,
  monthRank,
  streak,
  category,
  locale,
}: {
  monthPoints: number;
  todayPoints: number;
  monthRank: number | null;
  streak: number;
  category: string | null;
  locale: string;
}) {
  const t = useTranslations("rankingAthron");
  const tl = useTranslations("legacy");

  return (
    <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-transparent p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-orange-400" />
        <p className="text-sm font-bold">{t("yourRanking")}</p>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-xl font-black text-orange-300 tabular-nums flex items-center justify-center gap-1">
            <Zap className="h-3.5 w-3.5" />
            {todayPoints}
          </p>
          <p className="text-[9px] text-muted-foreground uppercase">
            {t("todayPoints")}
          </p>
        </div>
        <div>
          <p className="text-xl font-black text-orange-300 tabular-nums">
            {monthPoints}
          </p>
          <p className="text-[9px] text-muted-foreground uppercase">
            {t("points")}
          </p>
        </div>
        <div>
          <p className="text-xl font-black tabular-nums">
            {monthRank ?? "—"}
          </p>
          <p className="text-[9px] text-muted-foreground uppercase">
            {t("rank")}
          </p>
        </div>
        <div>
          <p className="text-xl font-black tabular-nums flex items-center justify-center gap-1">
            <Flame className="h-3.5 w-3.5 text-orange-400" />
            {streak}
          </p>
          <p className="text-[9px] text-muted-foreground uppercase">
            {t("streak")}
          </p>
        </div>
      </div>
      {category && (
        <p className="text-xs text-muted-foreground text-center">
          {t("yourCategory")}: {tl(`levels.${category}`)}
        </p>
      )}
      <Link
        href="/ranking"
        locale={locale}
        className="block text-center text-xs font-semibold text-orange-400 hover:text-orange-300"
      >
        {t("viewFullRanking")} →
      </Link>
    </div>
  );
}
