"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/routing";
import { parseScoreNumeric } from "@/lib/scores/helpers";
import type { ClaseScore, ClaseScoreTipo } from "@/types/database";

const SCORE_TYPES: ClaseScoreTipo[] = [
  "tiempo",
  "peso",
  "reps",
  "rondas",
  "cals",
  "otro",
];

type ScoreMode = ClaseScoreTipo | "sin_score";

export function ScoreEntryForm({
  claseId,
  reservaId,
  usuarioId,
  existing,
  onSaved,
  onCancel,
}: {
  claseId: string;
  reservaId: string;
  usuarioId: string;
  existing?: ClaseScore | null;
  onSaved?: (score: ClaseScore) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("scores");
  const tc = useTranslations("common");
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<ScoreMode>(
    existing?.sin_score ? "sin_score" : (existing?.score_tipo ?? "tiempo")
  );
  const [display, setDisplay] = useState(
    existing?.sin_score ? "" : (existing?.score_display ?? "")
  );
  const [rx, setRx] = useState(existing?.rx ?? true);
  const [notas, setNotas] = useState(existing?.notas ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isNoScoreMode = mode === "sin_score";
  const tipo: ClaseScoreTipo = isNoScoreMode ? "otro" : mode;

  const placeholderFor = (value: ClaseScoreTipo) => {
    switch (value) {
      case "tiempo":
        return "12:34";
      case "peso":
        return "225 lb";
      case "reps":
        return "150";
      case "rondas":
        return "8+12";
      case "cals":
        return "320";
      default:
        return t("displayPlaceholderOther");
    }
  };

  const save = async () => {
    setError(null);
    setSaved(false);

    let payload: {
      clase_id: string;
      usuario_id: string;
      reserva_id: string;
      score_display: string;
      score_tipo: ClaseScoreTipo;
      valor_numerico: number | null;
      rx: boolean;
      sin_score: boolean;
      notas: string | null;
    };

    if (isNoScoreMode) {
      payload = {
        clase_id: claseId,
        usuario_id: usuarioId,
        reserva_id: reservaId,
        score_display: "—",
        score_tipo: "otro",
        valor_numerico: null,
        rx: true,
        sin_score: true,
        notas: notas.trim() || null,
      };
    } else {
      const trimmed = display.trim();
      if (!trimmed) {
        setError(t("displayRequired"));
        return;
      }

      const valor = parseScoreNumeric(tipo, trimmed);
      if (tipo !== "otro" && valor === null) {
        setError(t("invalidScore"));
        return;
      }

      payload = {
        clase_id: claseId,
        usuario_id: usuarioId,
        reserva_id: reservaId,
        score_display: trimmed,
        score_tipo: tipo,
        valor_numerico: valor,
        rx,
        sin_score: false,
        notas: notas.trim() || null,
      };
    }

    setLoading(true);

    const { data, error: upsertError } = existing
      ? await supabase
          .from("clase_scores")
          .update(payload)
          .eq("id", existing.id)
          .select()
          .single()
      : await supabase
          .from("clase_scores")
          .upsert(payload, { onConflict: "clase_id,usuario_id" })
          .select()
          .single();

    setLoading(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    if (data) {
      onSaved?.(data as ClaseScore);
    }
    if (!isNoScoreMode) {
      void fetch("/api/ranking/award-wod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claseId, usuarioId }),
      });
    }
    setSaved(true);
    router.refresh();
  };

  return (
    <div className="space-y-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-orange-400" />
        <p className="text-sm font-semibold text-orange-200">
          {existing ? t("editScore") : t("logScore")}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">{t("logScoreHint")}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={isNoScoreMode ? "sm:col-span-2" : undefined}>
          <Label>{t("scoreType")}</Label>
          <Select
            value={mode}
            onValueChange={(v) => setMode(v as ScoreMode)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCORE_TYPES.map((st) => (
                <SelectItem key={st} value={st}>
                  {t(`types.${st}`)}
                </SelectItem>
              ))}
              <SelectItem value="sin_score" className="text-muted-foreground">
                {t("noScoreOption")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!isNoScoreMode && (
          <div>
            <Label>{t("rxScaled")}</Label>
            <Select
              value={rx ? "rx" : "scaled"}
              onValueChange={(v) => setRx(v === "rx")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rx">RX</SelectItem>
                <SelectItem value="scaled">{t("scaled")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {isNoScoreMode ? (
        <p className="text-xs text-muted-foreground rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
          {t("noScoreHint")}
        </p>
      ) : (
        <div>
          <Label>{t("yourResult")}</Label>
          <Input
            value={display}
            onChange={(e) => setDisplay(e.target.value)}
            placeholder={placeholderFor(tipo)}
            className="h-12 rounded-xl text-base"
          />
          {tipo === "tiempo" && (
            <p className="text-xs text-muted-foreground mt-1">{t("timeHint")}</p>
          )}
          {tipo === "cals" && (
            <p className="text-xs text-muted-foreground mt-1">{t("calsHint")}</p>
          )}
        </div>
      )}

      <div>
        <Label>{t("notesOptional")}</Label>
        <Textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          className="rounded-xl"
          placeholder={
            isNoScoreMode ? t("noScoreNotesPlaceholder") : t("notesPlaceholder")
          }
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="w-full h-11 rounded-xl sm:flex-1"
          onClick={() => void save()}
          disabled={loading}
        >
          {loading
            ? tc("loading")
            : isNoScoreMode
              ? t("saveNoScore")
              : existing
                ? t("updateScore")
                : t("saveScore")}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 rounded-xl sm:w-auto"
            onClick={onCancel}
            disabled={loading}
          >
            {tc("cancel")}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      {saved && (
        <p className="text-sm text-green-400 text-center">
          {isNoScoreMode ? t("savedNoScore") : t("saved")}
        </p>
      )}
    </div>
  );
}
