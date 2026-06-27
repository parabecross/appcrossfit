"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { AthleteAvatar } from "@/components/ui/athlete-avatar";
import { cn, formatDate, formatTime } from "@/lib/utils";
import type { DailyHistoryDay } from "@/lib/ranking/aggregate";

export function DailyHistory({
  days,
  locale,
}: {
  days: DailyHistoryDay[];
  locale: string;
}) {
  const t = useTranslations("rankingAthron");
  const [open, setOpen] = useState<string | null>(days[0]?.fecha ?? null);

  if (days.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        {t("noDailyHistory")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">{t("dailyHistory")}</h2>
      {days.map((day) => {
        const isOpen = open === day.fecha;
        return (
          <div
            key={day.fecha}
            className="rounded-2xl border border-white/10 overflow-hidden"
          >
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
              onClick={() => setOpen(isOpen ? null : day.fecha)}
            >
              <div className="text-left">
                <p className="font-semibold">{formatDate(day.fecha, locale)}</p>
                <p className="text-xs text-muted-foreground">
                  {day.classes.length}{" "}
                  {t("classesCount", { count: day.classes.length })} ·{" "}
                  {day.total_points} {t("pts")}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )}
              />
            </button>
            {isOpen && (
              <div className="p-4 space-y-4 border-t border-white/5">
                {day.classes.map((clase) => (
                  <div key={clase.clase_id} className="space-y-2">
                    <div>
                      <p className="font-semibold">{clase.clase_nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(clase.hora_inicio)} –{" "}
                        {formatTime(clase.hora_fin)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {clase.athletes.map((a) => (
                        <div
                          key={a.usuario_id}
                          className="flex items-center gap-3 rounded-xl bg-secondary/30 px-3 py-2"
                        >
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
                              {a.score_display ?? "—"} ·{" "}
                              {a.rx ? "RX" : "Scaled"}
                              {a.wod_rank ? ` · #${a.wod_rank}` : ""}
                              {(() => {
                                const wodEv = a.events.find(
                                  (e) => e.event_type === "wod_position"
                                );
                                const rxBonus = wodEv?.metadata?.rx_bonus;
                                return typeof rxBonus === "number" && rxBonus > 0
                                  ? ` · +${rxBonus} RX`
                                  : "";
                              })()}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-orange-300 tabular-nums">
                            +{a.day_points}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
