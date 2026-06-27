"use client";

import { useTranslations } from "next-intl";
import { AthleteAvatar } from "@/components/ui/athlete-avatar";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "@/lib/ranking/aggregate";

export function RankingHero({
  boxName,
  logoUrl,
  monthLabel,
  tagline,
}: {
  boxName: string;
  logoUrl: string | null;
  monthLabel: string;
  tagline: string;
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
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-400">
          {t("leagueTitle")}
        </p>
        <h1 className="text-3xl md:text-4xl font-black mt-2">{boxName}</h1>
        <p className="text-muted-foreground mt-1">{monthLabel}</p>
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
            "rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all",
            value === level
              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/25"
              : "bg-white/5 text-muted-foreground hover:bg-white/10"
          )}
        >
          {tl(`levels.${level}`)}
        </button>
      ))}
    </div>
  );
}

export function PodiumTop3({ rows }: { rows: LeaderboardRow[] }) {
  const t = useTranslations("rankingAthron");
  const top = rows.slice(0, 3);
  if (top.length === 0) return null;

  const order = [top[1], top[0], top[2]].filter(Boolean);

  return (
    <div className="grid grid-cols-3 gap-3 items-end max-w-2xl mx-auto py-6">
      {order.map((row, i) => {
        if (!row) return <div key={i} />;
        const place = row.rank;
        const height =
          place === 1 ? "h-36" : place === 2 ? "h-28" : "h-24";

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
                "ring-2 mb-2",
                place === 1 && "h-20 w-20 ring-yellow-400",
                place === 2 && "h-16 w-16 ring-slate-300",
                place === 3 && "h-14 w-14 ring-amber-600"
              )}
            />
            <p className="font-bold text-sm truncate max-w-full px-1">
              {row.nombre}
            </p>
            <p className="text-2xl font-black text-orange-300 tabular-nums">
              {row.total_points}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase">
              {t("points")}
            </p>
            <div
              className={cn(
                "w-full mt-3 rounded-t-2xl bg-gradient-to-t from-orange-500/20 to-orange-500/5 border border-orange-500/20 flex items-end justify-center pb-2",
                height
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
