"use client";

import { useTranslations } from "next-intl";
import { Ban, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isScoreSkipped } from "@/lib/scores/helpers";
import type { ClaseScore } from "@/types/database";

export function ScoreResponseSummary({
  score,
  onEdit,
}: {
  score: ClaseScore;
  onEdit?: () => void;
}) {
  const ts = useTranslations("scores");
  const skipped = isScoreSkipped(score);

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-orange-500/20 bg-orange-500/5 px-3 py-3">
      <div className="min-w-0">
        {skipped ? (
          <>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Ban className="h-3.5 w-3.5 shrink-0" />
              <p className="text-xs">{ts("noScoreRecorded")}</p>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {ts("noScoreRecordedHint")}
            </p>
            {score.notas && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {score.notas}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{ts("yourScore")}</p>
            <p className="text-lg font-bold text-orange-300 tabular-nums">
              {score.score_display}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ts(`types.${score.score_tipo}`)} ·{" "}
              {score.rx ? "RX" : ts("scaled")}
            </p>
            {score.notas && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {score.notas}
              </p>
            )}
          </>
        )}
      </div>
      {onEdit && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-orange-300 hover:text-orange-200 hover:bg-orange-500/10"
          aria-label={ts("editScore")}
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
