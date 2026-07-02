"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CupoProgress } from "@/components/clases/cupo-progress";
import { WorkoutBlock } from "@/components/clases/workout-block";
import { formatShortDay, formatTime } from "@/lib/utils";
import type { Clase } from "@/types/database";

export function AdminClassDetailDialog({
  clase,
  occupied,
  locale,
  open,
  onOpenChange,
}: {
  clase: Clase | null;
  occupied: number;
  locale: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("classes");

  if (!clase) return null;

  const statusKey = clase.estado as "programada" | "cancelada";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-8">{clase.nombre}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {formatShortDay(clase.fecha, locale)} · {formatTime(clase.hora_inicio)}{" "}
            – {formatTime(clase.hora_fin)}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {t(`status.${statusKey}`)}
            </Badge>
            {clase.coach_nombre && (
              <span className="text-sm text-muted-foreground">
                {t("coach")}: {clase.coach_nombre}
              </span>
            )}
          </div>

          <CupoProgress occupied={occupied} max={clase.cupo_maximo} showTone />

          <WorkoutBlock entrenamiento={clase.entrenamiento} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
