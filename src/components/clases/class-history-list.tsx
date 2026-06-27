"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime } from "@/lib/utils";
import { hasClassEnded } from "@/lib/clases/helpers";
import { ScoreEntryForm } from "@/components/clases/score-entry-form";
import { ScoreResponseSummary } from "@/components/clases/score-response-summary";
import { hasScoreResponse } from "@/lib/scores/helpers";
import type { AthleteClassHistoryItem } from "@/lib/queries/athlete-history";
import type { ClaseScore } from "@/types/database";
import type { ReservaEstado } from "@/types/database";

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
  const [scores, setScores] = useState(scoresByClaseId);
  const [editingClaseId, setEditingClaseId] = useState<string | null>(null);

  useEffect(() => {
    setScores(scoresByClaseId);
  }, [scoresByClaseId]);

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
      {items.map((r) => {
        const score = scores.get(r.clase_id);
        const canEnterScore =
          !!profileId &&
          !!gymTimezone &&
          hasClassEnded(r.clase.fecha, r.clase.hora_fin, gymTimezone) &&
          r.estado !== "no_asistio";
        const isEditing = editingClaseId === r.clase_id;
        const responded = hasScoreResponse(score);
        const showSaved = canEnterScore && responded && !isEditing;
        const showForm = canEnterScore && (!responded || isEditing);

        return (
          <div
            key={r.id}
            className="rounded-xl border border-white/10 bg-card/50 px-3 py-3 text-sm space-y-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
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

            {showSaved && score && (
              <ScoreResponseSummary
                score={score}
                onEdit={() => setEditingClaseId(r.clase_id)}
              />
            )}

            {showForm && profileId && (
              <ScoreEntryForm
                claseId={r.clase_id}
                reservaId={r.id}
                usuarioId={profileId}
                existing={score}
                onSaved={(saved) => {
                  setScores((prev) => new Map(prev).set(r.clase_id, saved));
                  setEditingClaseId(null);
                }}
                onCancel={
                  score ? () => setEditingClaseId(null) : undefined
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
