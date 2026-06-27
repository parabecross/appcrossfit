"use client";

import { useTranslations } from "next-intl";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { RANKING_LEVELS, type RankingRow } from "@/lib/scores/helpers";
import type { RankingLevel } from "@/lib/scores/helpers";

function RankingList({
  rows,
  highlightMe = false,
}: {
  rows: RankingRow[];
  highlightMe?: boolean;
}) {
  const t = useTranslations("scores");

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {t("noScoresInCategory")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const isMe = highlightMe && row.isMe;
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
  );
}

export function CategoryRankingPanel({
  level,
  rows,
  highlightMe,
}: {
  level: RankingLevel;
  rows: RankingRow[];
  highlightMe?: boolean;
}) {
  const t = useTranslations("scores");
  const tl = useTranslations("legacy");

  return (
    <div className="rounded-2xl border border-white/10 bg-card/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("legacyCategory")}
          </p>
          <h3 className="text-sm font-bold uppercase tracking-wider text-orange-300">
            {tl(`levels.${level}`)}
          </h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {t("athletesCount", { count: rows.length })}
        </span>
      </div>
      <RankingList rows={rows} highlightMe={highlightMe} />
    </div>
  );
}

export function DailyRankingView({
  data,
  locale,
  highlightMe,
  showShareHint = false,
}: {
  data: {
    box: { name: string; logo_url: string | null };
    date: string;
    todayDate?: string;
    isToday?: boolean;
    wods: {
      clase: {
        nombre: string;
        hora_inicio: string;
        hora_fin: string;
        entrenamiento: string | null;
      };
      categories: Record<RankingLevel, RankingRow[]> & {
        uncategorized: RankingRow[];
      };
      totalScores: number;
    }[];
  };
  locale: string;
  highlightMe?: boolean;
  showShareHint?: boolean;
}) {
  const t = useTranslations("scores");

  return (
    <div className="space-y-8">
      <header className="text-center space-y-2">
        {data.box.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.box.logo_url}
            alt=""
            className="mx-auto h-14 w-14 rounded-xl object-cover"
          />
        ) : null}
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-400">
          {t("publicRankingTitle")}
        </p>
        <h1 className="text-2xl md:text-3xl font-black">{data.box.name}</h1>
        <p className="text-muted-foreground">
          {formatDate(data.date, locale)} · {t("rankingByCategory")}
        </p>
        {data.isToday === false && data.todayDate && (
          <p className="text-xs text-orange-300/90">
            {t("rankingFallbackDate", {
              date: formatDate(data.date, locale),
            })}
          </p>
        )}
        {showShareHint && (
          <p className="text-xs text-muted-foreground max-w-lg mx-auto">
            {t("rankingRespect")}
          </p>
        )}
      </header>

      {data.wods.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center">
          <p className="text-muted-foreground font-medium">{t("noRankingYet")}</p>
          <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto">
            {t("noRankingYetHint")}
          </p>
        </div>
      ) : (
        data.wods.map((wod) => (
          <section
            key={wod.clase.nombre + wod.clase.hora_inicio}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="text-xl font-bold">{wod.clase.nombre}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {formatTime(wod.clase.hora_inicio)} –{" "}
                {formatTime(wod.clase.hora_fin)} ·{" "}
                {t("athletesCount", { count: wod.totalScores })}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {RANKING_LEVELS.map((level) => (
                <CategoryRankingPanel
                  key={level}
                  level={level}
                  rows={wod.categories[level]}
                  highlightMe={highlightMe}
                />
              ))}
            </div>

            {wod.categories.uncategorized.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-card/30 p-4 space-y-3">
                <h3 className="text-sm font-bold text-muted-foreground">
                  {t("uncategorized")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("uncategorizedHint")}
                </p>
                <RankingList
                  rows={wod.categories.uncategorized}
                  highlightMe={highlightMe}
                />
              </div>
            )}
          </section>
        ))
      )}

      <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground/60">
        Powered by ATHRON
      </p>
    </div>
  );
}
