"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime } from "@/lib/utils";
import type { AthleteClassHistoryItem } from "@/lib/queries/athlete-history";
import type { ReservaEstado } from "@/types/database";

export function ClassHistoryList({
  items,
  locale,
}: {
  items: AthleteClassHistoryItem[];
  locale: string;
}) {
  const tcl = useTranslations("classes");

  const badgeFor = (estado: ReservaEstado) => {
    if (estado === "asistio") {
      return <Badge variant="success">{tcl("attended")}</Badge>;
    }
    if (estado === "no_asistio") {
      return <Badge variant="destructive">{tcl("noShow")}</Badge>;
    }
    return <Badge variant="outline">{tcl("booked")}</Badge>;
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {items.map((r) => (
        <div
          key={r.id}
          className="flex flex-col gap-2 rounded-xl border border-white/10 bg-card/50 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="font-semibold truncate">{r.clase.nombre}</p>
            <p className="text-muted-foreground">
              {formatDate(r.clase.fecha, locale)} ·{" "}
              {formatTime(r.clase.hora_inicio)} –{" "}
              {formatTime(r.clase.hora_fin)}
            </p>
            {r.clase.coach_nombre && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {tcl("coach")}: {r.clase.coach_nombre}
              </p>
            )}
          </div>
          {badgeFor(r.estado)}
        </div>
      ))}
    </div>
  );
}
