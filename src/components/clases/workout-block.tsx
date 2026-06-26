"use client";

import { useTranslations } from "next-intl";
import { Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

export function WorkoutBlock({
  entrenamiento,
  compact = false,
  className,
}: {
  entrenamiento?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("classes");

  if (!entrenamiento?.trim()) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-white/10 bg-secondary/10 px-3 py-2.5",
          className
        )}
      >
        <p className="text-xs text-muted-foreground italic">{t("noWorkout")}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-primary/20 bg-primary/5",
        compact ? "px-3 py-2.5" : "px-3.5 py-3",
        className
      )}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Dumbbell className="h-3.5 w-3.5 text-primary shrink-0" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
          {t("workout")}
        </p>
      </div>
      <p
        className={cn(
          "text-sm text-foreground/90 whitespace-pre-line leading-relaxed",
          compact && "text-xs line-clamp-4"
        )}
      >
        {entrenamiento}
      </p>
    </div>
  );
}
