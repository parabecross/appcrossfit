"use client";

import { useTranslations } from "next-intl";
import { Progress } from "@/components/ui/progress";
import { Users } from "lucide-react";

interface CupoProgressProps {
  occupied: number;
  max: number;
}

export function CupoProgress({ occupied, max }: CupoProgressProps) {
  const t = useTranslations("classes");
  const pct = max > 0 ? (occupied / max) * 100 : 0;
  const almostFull = pct >= 80;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {t("spots", { occupied, max })}
        </span>
        <span
          className={
            almostFull ? "text-orange-400 font-semibold" : "text-muted-foreground"
          }
        >
          {Math.round(pct)}%
        </span>
      </div>
      <Progress
        value={pct}
        className={almostFull ? "[&>div]:bg-orange-500" : undefined}
      />
    </div>
  );
}
