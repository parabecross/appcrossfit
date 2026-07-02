"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { CupoProgress } from "@/components/clases/cupo-progress";
import { AdminClassActionsMenu } from "@/components/admin/clases/admin-class-actions-menu";
import { summarizeWorkout } from "@/lib/clases/workout-summary";
import { cn, formatTime } from "@/lib/utils";
import type { Clase, Profile } from "@/types/database";

export function AdminClassCardCompact({
  clase,
  occupied,
  locale,
  coaches,
  existingClases,
  canEdit,
  selected,
  onSelect,
  onUpdated,
  onDeleted,
}: {
  clase: Clase;
  occupied: number;
  locale: string;
  coaches: Profile[];
  existingClases: Clase[];
  canEdit: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onUpdated?: (clase: Clase) => void;
  onDeleted?: () => void;
}) {
  const t = useTranslations("classes");
  const summary = summarizeWorkout(clase.entrenamiento, 2);
  const statusKey = clase.estado as "programada" | "cancelada";
  const full = occupied >= clase.cupo_maximo;

  return (
    <article
      className={cn(
        "rounded-xl border bg-white/[0.02] px-3.5 py-3 transition-all",
        selected
          ? "border-orange-500/40 ring-1 ring-orange-500/25 bg-orange-500/[0.04]"
          : "border-white/8 hover:border-white/15 hover:bg-white/[0.03]",
        onSelect && "cursor-pointer"
      )}
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground tabular-nums">
              {formatTime(clase.hora_inicio)} – {formatTime(clase.hora_fin)}
            </p>
            <Badge
              variant={clase.estado === "cancelada" ? "destructive" : "secondary"}
              className="text-[10px] h-5"
            >
              {full && clase.estado === "programada"
                ? t("full")
                : t(`status.${statusKey}`)}
            </Badge>
          </div>
          <h3 className="font-bold text-sm leading-tight mt-1 truncate">
            {clase.nombre}
          </h3>
        </div>
        <AdminClassActionsMenu
          clase={clase}
          coaches={coaches}
          existingClases={existingClases}
          locale={locale}
          occupied={occupied}
          canEdit={canEdit}
          onUpdated={onUpdated}
          onDeleted={onDeleted}
          onSelect={onSelect}
        />
      </div>

      {clase.coach_nombre && (
        <p className="text-xs text-muted-foreground mt-2 truncate">
          {t("coach")}: <span className="text-foreground/90">{clase.coach_nombre}</span>
        </p>
      )}

      <div className="mt-2.5 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {t("workout")}
        </p>
        {summary.length > 0 ? (
          <div className="text-xs text-foreground/85 leading-relaxed space-y-0.5">
            {summary.map((line) => (
              <p key={line} className="line-clamp-1">
                {line}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">{t("noWorkout")}</p>
        )}
      </div>

      <div className="mt-3" onClick={(e) => e.stopPropagation()}>
        <CupoProgress
          occupied={occupied}
          max={clase.cupo_maximo}
          showTone
          compact
        />
      </div>
    </article>
  );
}
