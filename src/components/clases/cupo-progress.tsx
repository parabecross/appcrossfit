"use client";

import { useTranslations } from "next-intl";
import { Progress } from "@/components/ui/progress";
import { Users } from "lucide-react";

interface CupoProgressProps {
  occupied: number;
  max: number;
  showTone?: boolean;
  compact?: boolean;
}

export function CupoProgress({
  occupied,
  max,
  showTone = false,
  compact = false,
}: CupoProgressProps) {
  const t = useTranslations("classes");
  const pct = max > 0 ? (occupied / max) * 100 : 0;
  const tone =
    pct >= 90 ? "high" : pct >= 70 ? "medium" : "low";

  const barClass =
    showTone && tone === "high"
      ? "[&>div]:bg-red-500"
      : showTone && tone === "medium"
        ? "[&>div]:bg-orange-500"
        : showTone
          ? "[&>div]:bg-green-500"
          : pct >= 80
            ? "[&>div]:bg-orange-500"
            : undefined;

  const pctClass =
    showTone && tone === "high"
      ? "text-red-400 font-semibold"
      : showTone && tone === "medium"
        ? "text-orange-400 font-semibold"
        : showTone
          ? "text-green-400"
          : pct >= 80
            ? "text-orange-400 font-semibold"
            : "text-muted-foreground";

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div className="flex justify-between items-center text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {t("spots", { occupied, max })}
        </span>
        <span className={pctClass}>{Math.round(pct)}%</span>
      </div>
      <Progress value={pct} className={barClass} />
    </div>
  );
}
