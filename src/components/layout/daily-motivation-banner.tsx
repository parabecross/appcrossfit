"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Cake, Sparkles } from "lucide-react";
import {
  getDailyMotivationMessage,
  type MotivationAudience,
} from "@/lib/motivation/get-daily-message";
import { cn } from "@/lib/utils";

export function DailyMotivationBanner({
  audience,
  locale,
  today,
  birthdayGreeting,
  className,
}: {
  audience: MotivationAudience;
  locale: string;
  /** YYYY-MM-DD en zona del gym; calculado en el servidor para evitar hydration mismatch. */
  today: string;
  birthdayGreeting?: string | null;
  className?: string;
}) {
  const t = useTranslations("motivation");

  const message = useMemo(
    () => getDailyMotivationMessage(audience, locale, today),
    [audience, locale, today]
  );

  const isBirthday = Boolean(birthdayGreeting);

  return (
    <div
      className={cn(
        "flex gap-3 items-start rounded-2xl border px-4 py-3",
        isBirthday
          ? "border-amber-500/30 bg-amber-500/10"
          : "border-primary/20 bg-primary/5",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {isBirthday ? (
        <Cake className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" aria-hidden />
      ) : (
        <Sparkles
          className="h-5 w-5 text-primary shrink-0 mt-0.5"
          aria-hidden
        />
      )}
      <div className="min-w-0">
        <p
          className={cn(
            "text-[10px] font-bold uppercase tracking-wider",
            isBirthday ? "text-amber-400" : "text-primary"
          )}
        >
          {isBirthday ? t("birthdayTitle") : t("dailyTitle")}
        </p>
        <p
          className={cn(
            "text-sm leading-relaxed mt-0.5",
            isBirthday ? "text-amber-50/95" : "text-foreground/90"
          )}
        >
          {isBirthday ? birthdayGreeting : message}
        </p>
      </div>
    </div>
  );
}
