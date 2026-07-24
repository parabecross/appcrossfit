"use client";

import { useTranslations } from "next-intl";
import { Cake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BirthdayAlert } from "@/lib/queries/birthdays";
import type { BirthdayWindow } from "@/lib/birthdays/helpers";
import { cn } from "@/lib/utils";

const WINDOW_ORDER: BirthdayWindow[] = ["today", "tomorrow", "yesterday"];

export function BirthdayInfoCard({
  alerts,
}: {
  alerts: BirthdayAlert[];
}) {
  const t = useTranslations("birthdays");

  if (alerts.length === 0) return null;

  const grouped = WINDOW_ORDER.map((window) => ({
    window,
    items: alerts.filter((a) => a.window === window),
  })).filter((g) => g.items.length > 0);

  return (
    <Card className="border-amber-500/25 bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Cake className="h-5 w-5 text-amber-400 shrink-0" aria-hidden />
          <span>
            {t("title")} ({alerts.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {grouped.map(({ window, items }) => (
          <div
            key={window}
            className={cn(
              "rounded-xl px-3 py-2.5",
              window === "today"
                ? "border border-amber-500/30 bg-amber-500/10"
                : "border border-white/5 bg-white/[0.02]"
            )}
          >
            <p
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider mb-2",
                window === "today" ? "text-amber-400" : "text-muted-foreground"
              )}
            >
              {t(window)}
            </p>
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li
                  key={item.profileId}
                  className={cn(
                    "text-sm",
                    window === "today" ? "text-amber-50/95" : "text-foreground/90"
                  )}
                >
                  {item.age != null
                    ? `${item.nombre} — ${t("turningAge", { age: item.age })}`
                    : item.nombre}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
