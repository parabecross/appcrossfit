"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { AdminClassActionsMenu } from "@/components/admin/clases/admin-class-actions-menu";
import { occupancyTone } from "@/lib/clases/workout-summary";
import { cn, formatTime } from "@/lib/utils";
import type { Clase, Profile } from "@/types/database";

export function AdminClassListRow({
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
  const tone = occupancyTone(occupied, clase.cupo_maximo);
  const pct =
    clase.cupo_maximo > 0
      ? Math.round((occupied / clase.cupo_maximo) * 100)
      : 0;
  const statusKey = clase.estado as "programada" | "cancelada";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
        selected
          ? "border-orange-500/35 bg-orange-500/[0.05]"
          : "border-white/8 bg-white/[0.02] hover:bg-white/[0.04]",
        onSelect && "cursor-pointer"
      )}
      onClick={onSelect}
    >
      <div className="w-16 shrink-0">
        <p className="text-xs font-semibold tabular-nums">
          {formatTime(clase.hora_inicio)}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{clase.nombre}</p>
        <p className="text-xs text-muted-foreground truncate">
          {clase.coach_nombre ?? "—"}
        </p>
      </div>

      <div className="hidden sm:block text-right shrink-0 w-20">
        <p
          className={cn(
            "text-xs font-semibold tabular-nums",
            tone === "high" && "text-red-400",
            tone === "medium" && "text-orange-400",
            tone === "low" && "text-muted-foreground"
          )}
        >
          {occupied}/{clase.cupo_maximo}
        </p>
        <p className="text-[10px] text-muted-foreground">{pct}%</p>
      </div>

      <Badge variant="secondary" className="hidden md:inline-flex text-[10px] h-5 shrink-0">
        {t(`status.${statusKey}`)}
      </Badge>

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
  );
}
