"use client";

import { useTranslations } from "next-intl";
import { Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildClassRanking,
  filterScoresByLevel,
  type RankingLevel,
} from "@/lib/scores/helpers";
import type { ClaseScoreWithProfile } from "@/lib/queries/class-scores";
import type { AthleticLevel, Clase } from "@/types/database";

type ScoreWithLevel = ClaseScoreWithProfile & {
  nivel_deportivo?: AthleticLevel | null;
};

export function ClassRankingBoard({
  clase,
  scores,
  myProfileId,
  athleteLevel,
}: {
  clase: Clase;
  scores: ScoreWithLevel[];
  myProfileId: string;
  athleteLevel?: AthleticLevel | null;
}) {
  const t = useTranslations("scores");
  const tl = useTranslations("legacy");

  const categoryScores = filterScoresByLevel(
    scores,
    athleteLevel as RankingLevel | null | undefined
  );

  if (categoryScores.length === 0) return null;

  const ranking = buildClassRanking(categoryScores, myProfileId);
  const levelLabel = athleteLevel
    ? tl(`levels.${athleteLevel}`)
    : t("uncategorized");

  return (
    <div className="rounded-2xl border border-white/10 bg-card/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Medal className="h-4 w-4 text-orange-400" />
        <div>
          <p className="text-sm font-bold">{t("dailyRanking")}</p>
          <p className="text-xs text-muted-foreground">
            {clase.nombre} · {t("legacyCategory")}: {levelLabel} ·{" "}
            {t("athletesCount", { count: categoryScores.length })}
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{t("rankingCategoryNote")}</p>

      <div className="space-y-2">
        {ranking.map((row) => {
          const isMe = row.score.usuario_id === myProfileId;
          const medal =
            row.rank === 1
              ? "text-yellow-400"
              : row.rank === 2
                ? "text-slate-300"
                : row.rank === 3
                  ? "text-amber-600"
                  : "text-muted-foreground";

          return (
            <div
              key={row.score.id}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                isMe
                  ? "bg-orange-500/10 border border-orange-500/25"
                  : "bg-secondary/30"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-xs",
                  row.rank <= 3 ? medal : "text-muted-foreground bg-white/5"
                )}
              >
                {row.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">
                  {row.nombre}
                  {isMe && (
                    <span className="ml-1.5 text-xs font-normal text-orange-400">
                      ({t("you")})
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("wodWeights")}: {row.score.rx ? "RX" : t("scaled")} ·{" "}
                  {t(`types.${row.score.score_tipo}`)}
                </p>
              </div>
              <p className="shrink-0 font-bold text-orange-300 tabular-nums">
                {row.score.score_display}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
