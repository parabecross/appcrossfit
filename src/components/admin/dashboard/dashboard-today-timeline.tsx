"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  Award,
  CalendarCheck,
  ChevronDown,
  CreditCard,
  Dumbbell,
} from "lucide-react";
import { groupActivityByDay } from "@/lib/admin/dashboard-helpers";
import type { DashboardActivityEvent } from "@/lib/admin/dashboard-helpers";
import { addDaysToDateString } from "@/lib/dates/date-only";
import { formatDate, formatTime, cn } from "@/lib/utils";

const ICONS = {
  reserva: CalendarCheck,
  asistencia: Activity,
  pr: Dumbbell,
  skill: Award,
  membresia: CreditCard,
} as const;

function eventTime(at: string): string {
  if (at.includes("T")) {
    return formatTime(at.slice(11, 16));
  }
  return "—";
}

function dayHeading(
  dateKey: string,
  today: string,
  locale: string,
  labels: { today: string; yesterday: string }
): string {
  if (dateKey === today) return labels.today;
  if (dateKey === addDaysToDateString(today, -1)) return labels.yesterday;
  return formatDate(dateKey, locale);
}

export function DashboardTodayTimeline({
  events,
  today,
  locale,
  labels,
  hideHeader = false,
}: {
  events: DashboardActivityEvent[];
  today: string;
  locale: string;
  labels: {
    title: string;
    subtitle: string;
    empty: string;
    today: string;
    yesterday: string;
    types: Record<DashboardActivityEvent["type"], string>;
  };
  hideHeader?: boolean;
}) {
  const t = useTranslations("adminDashboard.today");
  const dayGroups = useMemo(() => groupActivityByDay(events), [events]);

  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => {
    const first = dayGroups[0]?.dateKey;
    return first ? new Set([first]) : new Set();
  });

  const toggleDay = (dateKey: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      {!hideHeader && (
        <div className="mb-4">
          <p className="text-sm font-bold">{labels.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{labels.subtitle}</p>
        </div>
      )}

      {dayGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="space-y-2">
          {dayGroups.map((group) => {
            const isOpen = expandedDays.has(group.dateKey);
            const heading = dayHeading(
              group.dateKey,
              today,
              locale,
              labels
            );

            return (
              <div
                key={group.dateKey}
                className="rounded-xl border border-white/10 overflow-hidden bg-black/20"
              >
                <button
                  type="button"
                  onClick={() => toggleDay(group.dateKey)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold capitalize">{heading}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("eventCount", { count: group.events.length })}
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
                  <div className="border-t border-white/5 px-3 py-2">
                    <ul className="relative pl-4">
                      <div
                        className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-orange-500/40 via-white/10 to-transparent"
                        aria-hidden
                      />
                      {group.events.map((e, i) => {
                        const Icon = ICONS[e.type];
                        return (
                          <li
                            key={e.id}
                            className={cn(
                              "relative flex gap-3 pb-4",
                              i === group.events.length - 1 && "pb-1"
                            )}
                          >
                            <div className="relative z-10 flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border-2 border-orange-500/50 bg-background mt-1">
                              <Icon className="h-2.5 w-2.5 text-orange-400" />
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium leading-tight">
                                  {e.title}
                                </p>
                                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                                  {eventTime(e.at)}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {labels.types[e.type]}
                                {e.subtitle ? ` · ${e.subtitle}` : ""}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
