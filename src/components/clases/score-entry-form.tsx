"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Check,
  CircleSlash,
  Dumbbell,
  Flame,
  Hash,
  RotateCcw,
  Timer,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/routing";
import { parseScoreNumeric, scoreTypeHasRxScaled } from "@/lib/scores/helpers";
import { cn } from "@/lib/utils";
import type { ClaseScore, ClaseScoreTipo } from "@/types/database";

const SCORE_TYPES: ClaseScoreTipo[] = [
  "tiempo",
  "peso",
  "reps",
  "rondas",
  "cals",
];

type ScoreMode = ClaseScoreTipo | "sin_score";

function inputModeForScoreTipo(
  tipo: ClaseScoreTipo
): "text" | "decimal" {
  if (tipo === "tiempo" || tipo === "rondas") return "text";
  return "decimal";
}

const TYPE_ICONS: Record<ClaseScoreTipo, typeof Timer> = {
  tiempo: Timer,
  peso: Dumbbell,
  reps: Hash,
  rondas: RotateCcw,
  cals: Flame,
  otro: Timer,
};

function initialScoreMode(existing?: ClaseScore | null): ScoreMode {
  if (existing?.sin_score) return "sin_score";
  if (!existing?.score_tipo || existing.score_tipo === "otro") return "tiempo";
  return existing.score_tipo;
}

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

  const [mode, setMode] = useState<ScoreMode>(() => initialScoreMode(existing));
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
  const showRxStep = !isNoScoreMode && scoreTypeHasRxScaled(tipo);
  const resultStep = showRxStep ? 3 : 2;

  const selectMode = (next: ScoreMode) => {
    setMode(next);
    setError(null);
    setSaved(false);
  };

  const placeholderFor = (value: ClaseScoreTipo) => {
    switch (value) {
      case "tiempo":
        return "12:34";
      case "peso":
        return "225";
      case "reps":
        return "150";
      case "rondas":
        return "8+12";
      case "cals":
        return "285";
      default:
        return "285";
    }
  };

  const exampleFor = (value: ClaseScoreTipo) => {
    switch (value) {
      case "tiempo":
        return t("exampleTiempo");
      case "peso":
        return t("examplePeso");
      case "reps":
        return t("exampleReps");
      case "rondas":
        return t("exampleRondas");
      case "cals":
        return t("exampleCals");
      default:
        return t("exampleCals");
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
      if (valor === null) {
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
        rx: scoreTypeHasRxScaled(tipo) ? rx : true,
        sin_score: false,
        notas: notas.trim() || null,
      };
    }

    setLoading(true);

    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const bodyJson = (await res.json().catch(() => ({}))) as {
      error?: string;
      score?: ClaseScore;
    };

    if (!res.ok) {
      setLoading(false);
      setError(
        bodyJson.error === "SCORE_WINDOW_CLOSED"
          ? t("windowClosed")
          : (bodyJson.error ?? tc("error"))
      );
      return;
    }

    const data = bodyJson.score;
    if (data) {
      onSaved?.(data);
    }

    try {
      const rankingRes = await fetch("/api/ranking/award-wod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claseId, usuarioId }),
      });
      if (!rankingRes.ok) {
        const rankingBody = (await rankingRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(rankingBody.error ?? t("rankingSyncFailed"));
      }
    } catch (syncError) {
      setLoading(false);
      setError(
        syncError instanceof Error ? syncError.message : t("rankingSyncFailed")
      );
      return;
    }

    setLoading(false);
    setSaved(true);
    router.refresh();
  };

  const saveLabel = loading
    ? tc("loading")
    : isNoScoreMode
      ? t("saveNoScore")
      : existing
        ? t("updateScore")
        : t("saveScore");

  return (
    <div className="rounded-2xl border border-orange-500/25 bg-gradient-to-b from-orange-500/10 to-orange-500/[0.03] overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-orange-500/15">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/20">
            <Trophy className="h-5 w-5 text-orange-300" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-foreground leading-snug">
              {existing ? t("editScoreTitle") : t("logScoreTitle")}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
              {t("logScoreSubtitle")}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-5">
        <section className="space-y-2.5">
          <Label className="text-sm font-semibold text-foreground">
            {t("stepType")}
          </Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SCORE_TYPES.map((st) => {
              const Icon = TYPE_ICONS[st];
              const selected = mode === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => selectMode(st)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-all",
                    selected
                      ? "border-orange-500 bg-orange-500/15 ring-1 ring-orange-500/40"
                      : "border-white/10 bg-black/20 hover:border-orange-500/30 hover:bg-white/[0.03]"
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-1">
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        selected ? "text-orange-300" : "text-muted-foreground"
                      )}
                    />
                    {selected && (
                      <Check className="h-3.5 w-3.5 text-orange-300 shrink-0" />
                    )}
                  </div>
                  <span className="text-sm font-semibold leading-tight">
                    {t(`typesFriendly.${st}`)}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-snug">
                    {t(`typeExamples.${st}`)}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => selectMode("sin_score")}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-all sm:col-span-3",
                isNoScoreMode
                  ? "border-white/25 bg-white/[0.06] ring-1 ring-white/20"
                  : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.03]"
              )}
            >
              <div className="flex w-full items-center justify-between gap-1">
                <CircleSlash className="h-4 w-4 shrink-0 text-muted-foreground" />
                {isNoScoreMode && (
                  <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
              </div>
              <span className="text-sm font-semibold leading-tight">
                {t("noScoreOption")}
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">
                {t("noScoreOptionHint")}
              </span>
            </button>
          </div>
        </section>

        {isNoScoreMode ? (
          <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("noScoreHint")}
            </p>
          </div>
        ) : (
          <>
            {showRxStep && (
              <section className="space-y-2.5">
                <div>
                  <Label className="text-sm font-semibold text-foreground">
                    {t("stepRx")}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("rxHint")}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRx(true)}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-left transition-all",
                      rx
                        ? "border-orange-500 bg-orange-500/15 ring-1 ring-orange-500/40"
                        : "border-white/10 bg-black/20 hover:border-orange-500/30"
                    )}
                  >
                    <p className="text-sm font-semibold">{t("rxYes")}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t("rxYesHint")}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRx(false)}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-left transition-all",
                      !rx
                        ? "border-orange-500 bg-orange-500/15 ring-1 ring-orange-500/40"
                        : "border-white/10 bg-black/20 hover:border-orange-500/30"
                    )}
                  >
                    <p className="text-sm font-semibold">{t("rxNo")}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t("rxNoHint")}
                    </p>
                  </button>
                </div>
              </section>
            )}

            <section className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                {t("stepResultLabel", { step: resultStep })}
              </Label>
              <Input
                value={display}
                onChange={(e) => setDisplay(e.target.value)}
                placeholder={placeholderFor(tipo)}
                className="h-14 rounded-xl text-xl font-bold text-center tracking-wide"
                inputMode={inputModeForScoreTipo(tipo)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <p className="text-sm text-center text-muted-foreground">
                {exampleFor(tipo)}
              </p>
            </section>
          </>
        )}

        <section className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">
            {t("notesOptional")}
          </Label>
          <Textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            className="rounded-xl text-sm"
            placeholder={
              isNoScoreMode ? t("noScoreNotesPlaceholder") : t("notesPlaceholder")
            }
          />
        </section>

        <div className="flex flex-col gap-2 pt-1">
          <Button
            className="w-full h-12 rounded-xl text-base font-semibold"
            onClick={() => void save()}
            disabled={loading}
          >
            {saveLabel}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              className="w-full h-10 rounded-xl text-muted-foreground"
              onClick={onCancel}
              disabled={loading}
            >
              {tc("cancel")}
            </Button>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-400 text-center rounded-lg bg-red-500/10 px-3 py-2">
            {error}
          </p>
        )}
        {saved && (
          <p className="text-sm text-green-400 text-center rounded-lg bg-green-500/10 px-3 py-2">
            {isNoScoreMode ? t("savedNoScore") : t("saved")}
          </p>
        )}
      </div>
    </div>
  );
}
