"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatShortDay, formatTime } from "@/lib/utils";
import type { ClaseScheduleSlot } from "@/lib/clases/helpers";

interface ScheduleOverlapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: ClaseScheduleSlot[];
  locale: string;
  onConfirm: () => void;
  loading?: boolean;
  confirmLabel?: string;
}

export function ScheduleOverlapDialog({
  open,
  onOpenChange,
  conflicts,
  locale,
  onConfirm,
  loading = false,
  confirmLabel,
}: ScheduleOverlapDialogProps) {
  const t = useTranslations("classes");
  const tc = useTranslations("common");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {t("scheduleOverlapTitle")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("scheduleOverlapDesc", { count: conflicts.length })}
          </p>
          <ul className="space-y-2 rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
            {conflicts.map((c) => (
              <li key={c.id ?? `${c.nombre}-${c.hora_inicio}`} className="text-sm">
                <span className="font-semibold">{c.nombre}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {formatShortDay(c.fecha, locale)} ·{" "}
                  {formatTime(c.hora_inicio)} – {formatTime(c.hora_fin)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-orange-300/90">{t("scheduleOverlapResponsibility")}</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {tc("cancel")}
            </Button>
            <Button onClick={onConfirm} disabled={loading} className="sm:min-w-[200px]">
              {loading ? tc("loading") : (confirmLabel ?? t("scheduleOverlapConfirm"))}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
