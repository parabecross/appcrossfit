"use client";

import { useTranslations } from "next-intl";
import { Progress } from "@/components/ui/progress";

interface CupoProgressProps {
  occupied: number;
  max: number;
}

export function CupoProgress({ occupied, max }: CupoProgressProps) {
  const t = useTranslations("classes");
  const pct = max > 0 ? (occupied / max) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{t("spots", { occupied, max })}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <Progress value={pct} />
    </div>
  );
}
