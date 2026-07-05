"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Dumbbell, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatRecordTipoLabel, formatPrValue } from "@/lib/progreso/helpers";
import { cn, formatCompactDate } from "@/lib/utils";
import type {
  AtletaPrMarca,
  AtletaSkill,
  AtletaSkillHistorial,
} from "@/types/database";

type DeleteTarget =
  | { type: "pr"; marca: AtletaPrMarca }
  | { type: "skill_hist"; entry: AtletaSkillHistorial };

function HistorySection({
  title,
  subtitle,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <div className="rounded-2xl border border-white/5 overflow-hidden bg-card/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-medium tabular-nums">
            {count}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </div>
      </button>
      {open && (
        <div className="border-t border-white/5 p-2 space-y-2 max-h-[min(60vh,28rem)] overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
}

export function ProgressHistoryPanel({
  marcas,
  skills,
  skillHistorial,
  locale,
  loading,
  onDeletePr,
  onDeleteSkillHistory,
}: {
  marcas: AtletaPrMarca[];
  skills: AtletaSkill[];
  skillHistorial: AtletaSkillHistorial[];
  locale: string;
  loading: boolean;
  onDeletePr: (marca: AtletaPrMarca) => Promise<void>;
  onDeleteSkillHistory: (entry: AtletaSkillHistorial) => Promise<void>;
}) {
  const t = useTranslations("progress");
  const tc = useTranslations("common");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  if (marcas.length === 0 && skillHistorial.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        {t("noHistory")}
      </p>
    );
  }

  const skillLabel = (entry: AtletaSkillHistorial) => {
    const sk = skills.find((s) => s.id === entry.skill_id);
    return sk ? t(`skills.${sk.skill}`) : t("skillUpdate");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "pr") {
      await onDeletePr(deleteTarget.marca);
    } else {
      await onDeleteSkillHistory(deleteTarget.entry);
    }
    setDeleteTarget(null);
  };

  const deleteTitle =
    deleteTarget?.type === "pr"
      ? t("deleteRecordTitle")
      : t("deleteSkillHistoryTitle");

  const deleteMessage = !deleteTarget
    ? ""
    : deleteTarget.type === "pr"
      ? t("deleteRecordConfirm", {
          record: `${t(`exercises.${deleteTarget.marca.ejercicio}`)} · ${formatPrValue(deleteTarget.marca.valor, deleteTarget.marca.unidad)}`,
        })
      : t("deleteSkillHistoryConfirm", {
          skill: skillLabel(deleteTarget.entry),
        });

  return (
    <>
      <div className="space-y-3">
        <HistorySection
          title={t("historySectionPrs")}
          subtitle={t("historySectionPrsHint")}
          count={marcas.length}
        >
          {marcas.map((m) => (
            <div
              key={m.id}
              className="flex gap-3 rounded-xl border border-white/5 bg-card/50 px-4 py-3"
            >
              <Dumbbell className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {t(`exercises.${m.ejercicio}`)} ·{" "}
                  {formatPrValue(m.valor, m.unidad)} ·{" "}
                  {formatRecordTipoLabel(m, t)}
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {formatCompactDate(m.fecha, locale)}
                </p>
                {m.notas && (
                  <p className="text-xs text-muted-foreground mt-1">{m.notas}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-red-400 hover:text-red-300"
                onClick={() => setDeleteTarget({ type: "pr", marca: m })}
                disabled={loading}
                aria-label={t("deleteRecord")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </HistorySection>

        <HistorySection
          title={t("historySectionSkills")}
          subtitle={t("historySectionSkillsHint")}
          count={skillHistorial.length}
        >
          {skillHistorial.map((h) => (
            <div
              key={h.id}
              className="flex gap-3 rounded-xl border border-white/5 bg-card/50 px-4 py-3"
            >
              <Sparkles className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{skillLabel(h)}</p>
                <p className="text-xs text-muted-foreground">
                  {h.estado_anterior
                    ? `${t(`skillStatus.${h.estado_anterior}`)} → ${t(`skillStatus.${h.estado_nuevo}`)}`
                    : t(`skillStatus.${h.estado_nuevo}`)}
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                  {formatCompactDate(h.created_at.slice(0, 10), locale)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-red-400 hover:text-red-300"
                onClick={() => setDeleteTarget({ type: "skill_hist", entry: h })}
                disabled={loading}
                aria-label={t("deleteSkillHistory")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </HistorySection>
      </div>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{deleteTitle}</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{deleteMessage}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDeleteTarget(null)}
                  disabled={loading}
                >
                  {tc("cancel")}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => void confirmDelete()}
                  disabled={loading}
                >
                  {loading ? tc("loading") : tc("delete")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
