"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { AthleteAvatar } from "@/components/ui/athlete-avatar";
import { Button } from "@/components/ui/button";
import {
  formatRankingDayParts,
} from "@/lib/dates/format-display";
import { groupDailyHistoryByWeek } from "@/lib/ranking/daily-history-grouping";
import { summarizePointBreakdown } from "@/lib/ranking/point-breakdown";
import {
  PointBreakdownChips,
  PointBreakdownDetails,
} from "@/components/ranking/athron/point-breakdown-view";
import { cn, formatTime } from "@/lib/utils";
import type { DailyHistoryDay } from "@/lib/ranking/aggregate";

const INITIAL_VISIBLE_WEEKS = 1;

export function DailyHistory({
  days,
  locale,
}: {
  days: DailyHistoryDay[];
  locale: string;
}) {
  const t = useTranslations("rankingAthron");
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(
    () => new Set()
  );
  const [visibleWeekCount, setVisibleWeekCount] = useState(
    INITIAL_VISIBLE_WEEKS
  );

  const weekGroups = useMemo(
    () => groupDailyHistoryByWeek(days, locale),
    [days, locale]
  );

  const visibleWeeks = useMemo(
    () => weekGroups.slice(0, visibleWeekCount),
    [weekGroups, visibleWeekCount]
  );

  const hasMoreWeeks = weekGroups.length > visibleWeekCount;

  const toggleWeek = (weekKey: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekKey)) next.delete(weekKey);
      else next.add(weekKey);
      return next;
    });
  };

  if (days.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        {t("noDailyHistory")}
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">{t("dailyHistory")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("dailyHistoryHint")}
          </p>
        </div>
        {weekGroups.length > INITIAL_VISIBLE_WEEKS && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {t("dailyHistoryShowing", {
              shown: visibleWeeks.reduce((n, w) => n + w.days.length, 0),
              total: days.length,
            })}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {visibleWeeks.map((week) => {
          const isWeekOpen = expandedWeeks.has(week.weekKey);

          return (
            <div
              key={week.weekKey}
              className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02]"
            >
              <button
                type="button"
                onClick={() => toggleWeek(week.weekKey)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.04] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold capitalize">
                    {t("dailyHistoryWeek", { range: week.label })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("dailyHistoryWeekSummary", {
                      days: week.days.length,
                      classes: week.totalClasses,
                      points: week.totalPoints,
                    })}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    isWeekOpen && "rotate-180"
                  )}
                />
              </button>

              {isWeekOpen && (
                <div className="border-t border-white/5 px-3 py-3">
                  <div className="relative pl-10">
                    <div className="absolute left-[1.125rem] top-2 bottom-2 w-px bg-gradient-to-b from-orange-500/50 via-orange-500/20 to-transparent" />

                    {week.days.map((day, index) => (
                      <DayTimelineRow
                        key={day.fecha}
                        day={day}
                        locale={locale}
                        isOpen={openDay === day.fecha}
                        isLast={index === week.days.length - 1}
                        onToggle={() =>
                          setOpenDay((cur) =>
                            cur === day.fecha ? null : day.fecha
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasMoreWeeks && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
          onClick={() => {
            setVisibleWeekCount((n) => n + 1);
          }}
        >
          {t("dailyHistoryLoadMore")}
        </Button>
      )}
    </section>
  );
}

function DayTimelineRow({
  day,
  locale,
  isOpen,
  isLast,
  onToggle,
}: {
  day: DailyHistoryDay;
  locale: string;
  isOpen: boolean;
  isLast: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("rankingAthron");
  const parts = formatRankingDayParts(day.fecha, locale);

  return (
    <div className={cn("relative", !isLast && "pb-3")}>
      <span
        className={cn(
          "absolute left-[-1.625rem] top-3 flex h-7 w-7 items-center justify-center rounded-full text-xs font-black tabular-nums ring-4 ring-background",
          isOpen
            ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
            : "bg-secondary text-orange-200"
        )}
      >
        {parts.day}
      </span>

      <div className="rounded-xl border border-white/10 overflow-hidden bg-black/20">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {parts.weekday}
              <span className="text-muted-foreground font-normal">
                {" · "}
                {parts.month}
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {day.classes.length}{" "}
              {t("classesCount", { count: day.classes.length })} ·{" "}
              <span className="text-orange-300/90 font-medium tabular-nums">
                {day.total_points} {t("pts")}
              </span>
            </p>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <div className="border-t border-white/5 p-3 space-y-4">
            {day.classes.map((clase) => (
              <div key={clase.clase_id} className="space-y-2">
                <div>
                  <p className="font-semibold text-sm">{clase.clase_nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(clase.hora_inicio)} –{" "}
                    {formatTime(clase.hora_fin)}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {clase.athletes.map((a) => {
                    const breakdown = summarizePointBreakdown(a.events);
                    return (
                    <div
                      key={a.usuario_id}
                      className="rounded-lg bg-secondary/30 px-3 py-2 space-y-2"
                    >
                      <div className="flex items-center gap-3">
                      <AthleteAvatar
                        fotoUrl={a.foto_url}
                        seed={a.usuario_id}
                        name={a.nombre}
                        className="h-8 w-8"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {a.nombre}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.score_display ?? "—"} · {a.rx ? "RX" : "Scaled"}
                          {a.wod_rank ? ` · #${a.wod_rank}` : ""}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-orange-300 tabular-nums">
                        +{a.day_points}
                      </p>
                      </div>
                      <PointBreakdownChips totals={breakdown.totals} />
                      <PointBreakdownDetails
                        details={breakdown.details}
                        locale={locale}
                      />
                    </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
