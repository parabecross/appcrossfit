"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Check,
  ChevronDown,
  CircleSlash,
  Dumbbell,
  Flame,
  Hash,
  RotateCcw,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/routing";
import {
  inferScoreTipoFromWorkout,
  parseScoreNumeric,
  resolveInitialScoreMode,
  scoreTypeHasRxScaled,
  type ScoreMode,
} from "@/lib/scores/helpers";
import { cn } from "@/lib/utils";
import type { ClaseScore, ClaseScoreTipo } from "@/types/database";

const SCORE_TYPES: ClaseScoreTipo[] = [
  "tiempo",
  "peso",
  "reps",
  "rondas",
  "cals",
];

function inputModeForScoreTipo(tipo: ClaseScoreTipo): "text" | "decimal" {
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

export function ScoreEntryForm({
  claseId,
  reservaId,
  usuarioId,
  existing,
  entrenamiento,
  onSaved,
  onCancel,
}: {
  claseId: string;
  reservaId: string;
  usuarioId: string;
  existing?: ClaseScore | null;
  /** Texto libre del WOD; se usa solo para preseleccionar tipo. */
  entrenamiento?: string | null;
  onSaved?: (score: ClaseScore) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("scores");
  const tc = useTranslations("common");
  const router = useRouter();
  const savingRef = useRef(false);

  const inferredTipo = inferScoreTipoFromWorkout(entrenamiento);
  const [mode, setMode] = useState<ScoreMode>(() =>
    resolveInitialScoreMode(existing, entrenamiento)
  );
  const [typeLocked, setTypeLocked] = useState(
    () => !existing && inferredTipo != null
  );
  const [display, setDisplay] = useState(
    existing?.sin_score ? "" : (existing?.score_display ?? "")
  );
  const [rx, setRx] = useState(existing?.rx ?? true);
  const [notas, setNotas] = useState(existing?.notas ?? "");
  const [notesOpen, setNotesOpen] = useState(() => Boolean(existing?.notas?.trim()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isNoScoreMode = mode === "sin_score";
  const tipo: ClaseScoreTipo = isNoScoreMode ? "otro" : mode;
  const showRxStep = !isNoScoreMode && scoreTypeHasRxScaled(tipo);
  const isEdit = Boolean(existing);

  const selectMode = (next: ScoreMode) => {
    setMode(next);
    setTypeLocked(false);
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
    if (savingRef.current || loading) return;
    savingRef.current = true;
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
        savingRef.current = false;
        setError(t("displayRequired"));
        return;
      }

      const valor = parseScoreNumeric(tipo, trimmed);
      if (valor === null) {
        savingRef.current = false;
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

    try {
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

      const rankingRes = await fetch("/api/ranking/award-wod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claseId, usuarioId }),
      });
      if (!rankingRes.ok) {
        const rankingBody = (await rankingRes.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(rankingBody.error ?? t("rankingSyncFailed"));
        return;
      }

      setSaved(true);
      router.refresh();
    } catch (syncError) {
      setError(
        syncError instanceof Error ? syncError.message : t("rankingSyncFailed")
      );
    } finally {
      setLoading(false);
      savingRef.current = false;
    }
  };

  const saveLabel = loading
    ? tc("loading")
    : isNoScoreMode
      ? t("saveNoScore")
      : isEdit
        ? t("updateScore")
        : t("saveScoreCompact");

  const typeLabel =
    mode === "sin_score"
      ? t("noScoreOption")
      : t(`typesFriendly.${mode as ClaseScoreTipo}`);

  return (
    <div className="rounded-2xl border border-orange-500/25 bg-gradient-to-b from-orange-500/10 to-orange-500/[0.03] overflow-hidden max-w-lg">
      <div className="px-3 pt-3 pb-2 border-b border-orange-500/15">
        <p className="text-sm font-bold text-foreground leading-snug">
          {isEdit ? t("editScoreCompact") : t("logScoreCompact")}
        </p>
      </div>

      <div className="p-3 space-y-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {/* Tipo */}
        <section className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t("scoreType")}
            </Label>
            {typeLocked && inferredTipo && (
              <button
                type="button"
                className="text-xs font-medium text-orange-300 hover:text-orange-200"
                onClick={() => setTypeLocked(false)}
              >
                {t("changeType")}
              </button>
            )}
          </div>

          {typeLocked && inferredTipo && mode === inferredTipo ? (
            <div
              className="flex h-11 items-center gap-2 rounded-xl border border-orange-500/40 bg-orange-500/10 px-3"
              role="status"
            >
              {(() => {
                const Icon = TYPE_ICONS[inferredTipo];
                return <Icon className="h-4 w-4 text-orange-300 shrink-0" />;
              })()}
              <span className="text-sm font-semibold">{typeLabel}</span>
              <span className="ml-auto text-[10px] uppercase tracking-wide text-orange-300/80">
                {t("inferredFromWod")}
              </span>
            </div>
          ) : (
            <div
              className="grid grid-cols-3 gap-1.5"
              role="radiogroup"
              aria-label={t("scoreType")}
            >
              {SCORE_TYPES.map((st) => {
                const Icon = TYPE_ICONS[st];
                const selected = mode === st;
                return (
                  <button
                    key={st}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => selectMode(st)}
                    className={cn(
                      "flex h-11 min-h-11 items-center justify-center gap-1.5 rounded-xl border px-1.5 text-center transition-all",
                      selected
                        ? "border-orange-500 bg-orange-500/15 ring-1 ring-orange-500/40"
                        : "border-white/10 bg-black/20 hover:border-orange-500/30"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        selected ? "text-orange-300" : "text-muted-foreground"
                      )}
                      aria-hidden
                    />
                    <span className="text-[11px] font-semibold leading-tight truncate">
                      {t(`types.${st}`)}
                    </span>
                    {selected && (
                      <Check
                        className="h-3 w-3 text-orange-300 shrink-0 hidden sm:block"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                role="radio"
                aria-checked={isNoScoreMode}
                onClick={() => selectMode("sin_score")}
                className={cn(
                  "col-span-3 flex h-11 min-h-11 items-center justify-center gap-2 rounded-xl border px-2 transition-all",
                  isNoScoreMode
                    ? "border-white/25 bg-white/[0.06] ring-1 ring-white/20"
                    : "border-white/10 bg-black/20 hover:border-white/20"
                )}
              >
                <CircleSlash
                  className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                  aria-hidden
                />
                <span className="text-xs font-semibold">{t("noScoreOption")}</span>
              </button>
            </div>
          )}
        </section>

        {/* Resultado primero en jerarquía tras el tipo */}
        {!isNoScoreMode && (
          <section className="space-y-1.5">
            <Label
              htmlFor={`score-display-${claseId}`}
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {t("yourResult")}
            </Label>
            <Input
              id={`score-display-${claseId}`}
              value={display}
              onChange={(e) => setDisplay(e.target.value)}
              placeholder={placeholderFor(tipo)}
              className="h-12 rounded-xl text-lg font-bold text-center tracking-wide"
              inputMode={inputModeForScoreTipo(tipo)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-describedby={`score-example-${claseId}`}
            />
            <p
              id={`score-example-${claseId}`}
              className="text-[11px] text-center text-muted-foreground leading-snug"
            >
              {exampleFor(tipo)}
            </p>
          </section>
        )}

        {/* RX / Scaled compacto */}
        {showRxStep && (
          <section className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t("rxScaled")}
            </Label>
            <div
              className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/25 p-1"
              role="radiogroup"
              aria-label={t("rxScaled")}
            >
              <button
                type="button"
                role="radio"
                aria-checked={rx}
                onClick={() => setRx(true)}
                className={cn(
                  "h-10 rounded-lg text-sm font-semibold transition-all",
                  rx
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                RX
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!rx}
                onClick={() => setRx(false)}
                className={cn(
                  "h-10 rounded-lg text-sm font-semibold transition-all",
                  !rx
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t("scaled")}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug">
              {rx ? t("rxYesHintShort") : t("rxNoHintShort")}
            </p>
          </section>
        )}

        {isNoScoreMode && (
          <p className="text-xs text-muted-foreground leading-snug rounded-lg bg-black/25 px-3 py-2">
            {t("noScoreHintCompact")}
          </p>
        )}

        {/* Notas colapsables */}
        <section>
          {!notesOpen ? (
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              className="flex h-10 w-full items-center justify-center gap-1 rounded-xl border border-dashed border-white/15 text-xs font-medium text-muted-foreground hover:border-orange-500/30 hover:text-foreground"
            >
              {t("addNote")}
            </button>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label
                  htmlFor={`score-notes-${claseId}`}
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  {t("notesOptional")}
                </Label>
                <button
                  type="button"
                  className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => setNotesOpen(false)}
                >
                  <ChevronDown className="h-3.5 w-3.5 rotate-180" aria-hidden />
                  {t("hideNote")}
                </button>
              </div>
              <Textarea
                id={`score-notes-${claseId}`}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                className="min-h-[64px] rounded-xl text-sm"
                placeholder={
                  isNoScoreMode
                    ? t("noScoreNotesPlaceholder")
                    : t("notesPlaceholder")
                }
              />
            </div>
          )}
        </section>

        {error && (
          <p
            className="text-sm text-red-400 text-center rounded-lg bg-red-500/10 px-3 py-2"
            role="alert"
          >
            {error}
          </p>
        )}
        {saved && (
          <p
            className="text-sm text-green-400 text-center rounded-lg bg-green-500/10 px-3 py-2"
            role="status"
          >
            {isNoScoreMode ? t("savedNoScore") : t("saved")}
          </p>
        )}

        <div className="sticky bottom-0 z-10 -mx-3 px-3 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#121212] via-[#121212]/95 to-transparent space-y-1.5">
          <Button
            className="w-full h-11 rounded-xl text-sm font-semibold"
            onClick={() => void save()}
            disabled={loading}
            aria-busy={loading}
          >
            {saveLabel}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              className="w-full h-9 rounded-xl text-xs text-muted-foreground"
              onClick={onCancel}
              disabled={loading}
            >
              {tc("cancel")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
