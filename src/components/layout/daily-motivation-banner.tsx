"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import {
  getDailyMotivationMessage,
  type MotivationAudience,
} from "@/lib/motivation/get-daily-message";
import { cn } from "@/lib/utils";

export function DailyMotivationBanner({
  audience,
  locale,
  className,
}: {
  audience: MotivationAudience;
  locale: string;
  className?: string;
}) {
  const t = useTranslations("motivation");

  const message = useMemo(
    () => getDailyMotivationMessage(audience, locale),
    [audience, locale]
  );

  return (
    <div
      className={cn(
        "flex gap-3 items-start rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
          {t("dailyTitle")}
        </p>
        <p className="text-sm text-foreground/90 leading-relaxed mt-0.5">
          {message}
        </p>
      </div>
    </div>
  );
}
