"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTime, cn } from "@/lib/utils";
import { hasClassEnded } from "@/lib/clases/helpers";
import {
  countByStatus,
  filterHistoryItems,
  groupHistoryByMonthDay,
  type HistoryPeriodFilter,
  type HistoryStatusFilter,
} from "@/lib/clases/history-grouping";
import { ScoreEntryForm } from "@/components/clases/score-entry-form";
import { hasScoreResponse, isScoreSkipped } from "@/lib/scores/helpers";
import type { AthleteClassHistoryItem } from "@/lib/queries/athlete-history";
import type { ClaseScore } from "@/types/database";
import type { ReservaEstado } from "@/types/database";

const STATUS_FILTERS: HistoryStatusFilter[] = [
  "all",
  "asistio",
  "confirmada",
  "no_asistio",
];

const PERIOD_FILTERS: HistoryPeriodFilter[] = ["30d", "month", "90d", "all"];

export function ClassHistoryList({
  items,
  locale,
  profileId,
  gymTimezone,
  scoresByClaseId = new Map(),
}: {
  items: AthleteClassHistoryItem[];
  locale: string;
  profileId?: string;
  gymTimezone?: string;
  scoresByClaseId?: Map<string, ClaseScore>;
}) {
  const tcl = useTranslations("classes");

  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("all");
  const [periodFilter, setPeriodFilter] =
    useState<HistoryPeriodFilter>("30d");
  const [visibleMonths, setVisibleMonths] = useState(2);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    () => new Set()
  );
  const [expandedClaseId, setExpandedClaseId] = useState<string | null>(null);
  const [scores, setScores] = useState(scoresByClaseId);

  useEffect(() => {
    setScores(scoresByClaseId);
  }, [scoresByClaseId]);

  const counts = useMemo(() => countByStatus(items), [items]);

  const filtered = useMemo(
    () => filterHistoryItems(items, statusFilter, periodFilter),
    [items, statusFilter, periodFilter]
  );

  const monthGroups = useMemo(
    () => groupHistoryByMonthDay(filtered, locale),
    [filtered, locale]
  );

  const displayMonths = useMemo(() => {
    if (periodFilter !== "all") return monthGroups;
    return monthGroups.slice(0, visibleMonths);
  }, [monthGroups, periodFilter, visibleMonths]);

  useEffect(() => {
    if (monthGroups.length === 0) return;
    setExpandedMonths((prev) => {
      if (prev.size > 0) return prev;
      return new Set([monthGroups[0].monthKey]);
    });
  }, [monthGroups]);

  const canEnterScores = !!profileId && !!gymTimezone;

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  };

  const badgeFor = (estado: ReservaEstado, compact = false) => {
    if (estado === "asistio") {
      return (
        <Badge variant="success" className={compact ? "text-[10px] px-1.5 py-0" : undefined}>
          {tcl("attended")}
        </Badge>
      );
    }
    if (estado === "no_asistio") {
      return (
        <Badge variant="destructive" className={compact ? "text-[10px] px-1.5 py-0" : undefined}>
          {tcl("noShow")}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className={compact ? "text-[10px] px-1.5 py-0" : undefined}>
        {tcl("booked")}
      </Badge>
    );
  };

  const statusLabel = (key: HistoryStatusFilter) => {
    if (key === "all") return tcl("historyFilterAll");
    if (key === "asistio") return tcl("attended");
    if (key === "confirmada") return tcl("booked");
    return tcl("noShow");
  };

  const scoreChip = (score: ClaseScore | undefined) => {
    if (!score || !hasScoreResponse(score)) return null;
    if (isScoreSkipped(score)) {
      return (
        <span className="text-[11px] text-muted-foreground shrink-0">
          {tcl("historyNoScore")}
        </span>
      );
    }
    return (
      <span className="text-[11px] font-semibold text-orange-300 tabular-nums shrink-0 max-w-[88px] truncate">
        {score.score_display}
      </span>
    );
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((key) => {
            const count =
              key === "all" ? counts.all : counts[key];
            if (key !== "all" && count === 0) return null;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  statusFilter === key
                    ? "bg-orange-500/20 text-orange-200 ring-1 ring-orange-500/40"
                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
                )}
              >
                {statusLabel(key)}
                <span className="ml-1 opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        <Select
          value={periodFilter}
          onValueChange={(v) => {
            setPeriodFilter(v as HistoryPeriodFilter);
            setVisibleMonths(2);
            setExpandedMonths(new Set());
          }}
        >
          <SelectTrigger className="w-full sm:w-44 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_FILTERS.map((p) => (
              <SelectItem key={p} value={p} className="text-xs">
                {tcl(`historyPeriod_${p}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {tcl("historyNoResults")}
        </p>
      ) : (
        <div className="space-y-2">
          {displayMonths.map((month) => {
            const isOpen = expandedMonths.has(month.monthKey);
            return (
              <div
                key={month.monthKey}
                className="rounded-xl border border-white/10 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleMonth(month.monthKey)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold capitalize">
                      {month.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tcl("historyMonthSummary", {
                        count: month.total,
                        attended: month.attended,
                      })}
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
                  <div className="divide-y divide-white/5">
                    {month.days.map((day) => (
                      <div key={day.date} className="px-2 py-1">
                        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {day.label}
                        </p>
                        <ul className="space-y-0.5">
                          {day.items.map((r) => {
                            const score = scores.get(r.clase_id);
                            const classEnded =
                              !!gymTimezone &&
                              hasClassEnded(
                                r.clase.fecha,
                                r.clase.hora_fin,
                                gymTimezone
                              );
                            const canScore =
                              canEnterScores &&
                              classEnded &&
                              r.estado !== "no_asistio";
                            const isExpanded = expandedClaseId === r.clase_id;
                            const responded = hasScoreResponse(score);

                            return (
                              <li key={r.id}>
                                <div
                                  className={cn(
                                    "flex items-center gap-2 rounded-lg px-2 py-2 text-sm",
                                    canScore && "hover:bg-white/5 cursor-pointer",
                                    isExpanded && "bg-white/[0.03]"
                                  )}
                                  onClick={() => {
                                    if (!canScore) return;
                                    setExpandedClaseId((cur) =>
                                      cur === r.clase_id ? null : r.clase_id
                                    );
                                  }}
                                  onKeyDown={(e) => {
                                    if (!canScore) return;
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      setExpandedClaseId((cur) =>
                                        cur === r.clase_id ? null : r.clase_id
                                      );
                                    }
                                  }}
                                  role={canScore ? "button" : undefined}
                                  tabIndex={canScore ? 0 : undefined}
                                >
                                  <span className="w-[4.5rem] shrink-0 text-xs text-muted-foreground tabular-nums">
                                    {formatTime(r.clase.hora_inicio)}
                                  </span>
                                  <span className="flex-1 min-w-0 font-medium truncate">
                                    {r.clase.nombre}
                                  </span>
                                  {r.clase.coach_nombre && (
                                    <span className="hidden md:inline text-xs text-muted-foreground truncate max-w-[7rem]">
                                      {r.clase.coach_nombre.split(" ")[0]}
                                    </span>
                                  )}
                                  {canEnterScores && scoreChip(score)}
                                  <span className="shrink-0">
                                    {badgeFor(r.estado, true)}
                                  </span>
                                  {canScore && (
                                    <span className="shrink-0 text-muted-foreground">
                                      {responded ? (
                                        <Pencil className="h-3.5 w-3.5" />
                                      ) : (
                                        <Plus className="h-3.5 w-3.5 text-orange-400" />
                                      )}
                                    </span>
                                  )}
                                </div>

                                {canScore && isExpanded && profileId && (
                                  <div className="px-2 pb-3 pt-1 ml-[4.5rem]">
                                    <ScoreEntryForm
                                      claseId={r.clase_id}
                                      reservaId={r.id}
                                      usuarioId={profileId}
                                      existing={score}
                                      onSaved={(saved) => {
                                        setScores((prev) =>
                                          new Map(prev).set(r.clase_id, saved)
                                        );
                                        setExpandedClaseId(null);
                                      }}
                                      onCancel={() => setExpandedClaseId(null)}
                                    />
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {periodFilter === "all" &&
            monthGroups.length > visibleMonths && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setVisibleMonths((n) => n + 3)}
              >
                {tcl("historyLoadMore")}
              </Button>
            )}
        </div>
      )}
    </div>
  );
}
