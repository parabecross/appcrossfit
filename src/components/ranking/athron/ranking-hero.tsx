"use client";

import { useTranslations } from "next-intl";
import { AthleteAvatar } from "@/components/ui/athlete-avatar";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "@/lib/ranking/aggregate";
import { RankingMonthSelector } from "./ranking-month-selector";

export function RankingHero({
  boxName,
  logoUrl,
  monthLabel,
  tagline,
  isCurrentMonth,
  monthKey,
  currentMonthKey,
  availableMonths,
  locale,
  onMonthChange,
}: {
  boxName: string;
  logoUrl: string | null;
  monthLabel: string;
  tagline: string;
  isCurrentMonth: boolean;
  monthKey: string;
  currentMonthKey: string;
  availableMonths: string[];
  locale: string;
  onMonthChange: (monthKey: string) => void;
}) {
  const t = useTranslations("rankingAthron");

  return (
    <header className="text-center space-y-4 py-6">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="mx-auto h-16 w-16 rounded-2xl object-cover ring-2 ring-orange-500/30"
        />
      ) : null}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-400">
          {t("leagueTitle")}
        </p>
        <h1 className="text-3xl md:text-4xl font-black mt-1">{boxName}</h1>
        <div className="flex flex-col items-center gap-2 pt-1">
          <RankingMonthSelector
            monthKey={monthKey}
            currentMonthKey={currentMonthKey}
            availableMonths={availableMonths}
            locale={locale}
            onChange={onMonthChange}
          />
          {isCurrentMonth ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-orange-300">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" aria-hidden />
              {t("monthCurrentBadge")}
            </span>
          ) : (
            <p className="text-xs text-muted-foreground">{t("monthHistorical")}</p>
          )}
        </div>
        <p className="sr-only">{monthLabel}</p>
      </div>
      <p className="text-sm md:text-base text-orange-200/90 font-medium italic max-w-lg mx-auto">
        &ldquo;{tagline}&rdquo;
      </p>
    </header>
  );
}

export function CategorySelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const tl = useTranslations("legacy");
  const levels = ["beginner", "intermediate", "advanced", "rx"] as const;

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {levels.map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => onChange(level)}
          className={cn(
            "rounded-full px-4 py-2.5 min-h-11 text-xs font-bold uppercase tracking-wider transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60",
            value === level
              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/25"
              : "bg-white/5 text-muted-foreground hover:bg-white/10 border border-white/10"
          )}
        >
          {tl(`levels.${level}`)}
        </button>
      ))}
    </div>
  );
}

export function PodiumTop3({
  rows,
  viewerProfileId,
}: {
  rows: LeaderboardRow[];
  viewerProfileId?: string | null;
}) {
  const t = useTranslations("rankingAthron");
  const top = rows.slice(0, 3);
  if (top.length === 0) return null;

  const order = [top[1], top[0], top[2]].filter(Boolean);

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 items-end max-w-2xl mx-auto py-6 px-1">
      {order.map((row, i) => {
        if (!row) return <div key={i} />;
        const place = row.rank;
        const height =
          place === 1 ? "h-36" : place === 2 ? "h-28" : "h-24";
        const isViewer = viewerProfileId === row.usuario_id;

        return (
          <div
            key={row.usuario_id}
            className={cn(
              "flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500",
              place === 1 && "order-2",
              place === 2 && "order-1",
              place === 3 && "order-3"
            )}
          >
            <AthleteAvatar
              fotoUrl={row.foto_url}
              seed={row.usuario_id}
              name={row.nombre}
              className={cn(
                "ring-2 mb-2 transition-shadow",
                place === 1 && "h-20 w-20 ring-yellow-400/90",
                place === 2 && "h-16 w-16 ring-neutral-300/80",
                place === 3 && "h-14 w-14 ring-amber-700/90",
                isViewer && "ring-orange-400 shadow-[0_0_0_3px_rgba(249,115,22,0.25)]"
              )}
            />
            <p className="font-bold text-sm truncate max-w-full px-1">
              {row.nombre}
            </p>
            <p
              className={cn(
                "text-2xl font-black tabular-nums",
                place === 1 ? "text-orange-300" : "text-foreground"
              )}
            >
              {row.total_points}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase">
              {t("points")}
            </p>
            <div
              className={cn(
                "w-full mt-3 rounded-t-2xl bg-gradient-to-t from-orange-500/20 to-transparent border border-orange-500/20 flex items-end justify-center pb-2",
                height,
                isViewer && "border-orange-400/40 shadow-[0_0_24px_rgba(249,115,22,0.12)]"
              )}
            >
              <span className="text-3xl font-black text-orange-400/80">
                {place}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
