"use client";

import { useTranslations } from "next-intl";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { AthleteAvatar } from "@/components/ui/athlete-avatar";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "@/lib/ranking/aggregate";

export function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  const t = useTranslations("rankingAthron");
  const tl = useTranslations("legacy");

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 py-12 text-center text-muted-foreground">
        {t("emptyLeaderboard")}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden">
      <div className="hidden md:grid grid-cols-[3rem_1fr_6rem_5rem_5rem_4rem] gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-white/[0.03]">
        <span>#</span>
        <span>{t("athlete")}</span>
        <span className="text-right">{t("points")}</span>
        <span className="text-right">{t("attendances")}</span>
        <span className="text-right">{t("streak")}</span>
        <span className="text-right">Δ</span>
      </div>
      <div className="divide-y divide-white/5">
        {rows.map((row) => (
          <div
            key={row.usuario_id}
            className="grid grid-cols-[3rem_1fr_auto] md:grid-cols-[3rem_1fr_6rem_5rem_5rem_4rem] gap-3 items-center px-4 py-3 hover:bg-white/[0.02] transition-colors"
          >
            <span
              className={cn(
                "font-black text-lg tabular-nums",
                row.rank <= 3 ? "text-orange-300" : "text-muted-foreground"
              )}
            >
              {row.rank}
            </span>
            <div className="flex items-center gap-3 min-w-0">
              <AthleteAvatar
                fotoUrl={row.foto_url}
                seed={row.usuario_id}
                name={row.nombre}
                className="h-10 w-10 shrink-0"
              />
              <div className="min-w-0">
                <p className="font-semibold truncate">{row.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {row.category
                    ? tl(`levels.${row.category}`)
                    : t("uncategorized")}{" "}
                  · {row.box_name}
                </p>
              </div>
            </div>
            <div className="md:contents flex flex-col items-end gap-0.5 text-sm">
              <span className="font-bold text-orange-300 tabular-nums md:text-right">
                {row.total_points} {t("pts")}
              </span>
              <span className="text-xs text-muted-foreground md:hidden">
                {row.attendances} {t("attendancesShort")} · 🔥 {row.streak}
              </span>
              <span className="hidden md:block text-right tabular-nums">
                {row.attendances}
              </span>
              <span className="hidden md:block text-right tabular-nums">
                {row.streak}
              </span>
              <span className="hidden md:flex justify-end">
                <RankDelta delta={row.rank_delta} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankDelta({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) {
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
  if (delta > 0) {
    return (
      <span className="flex items-center text-green-400 text-xs font-bold">
        <TrendingUp className="h-3.5 w-3.5 mr-0.5" />+{delta}
      </span>
    );
  }
  return (
    <span className="flex items-center text-red-400 text-xs font-bold">
      <TrendingDown className="h-3.5 w-3.5 mr-0.5" />
      {delta}
    </span>
  );
}
