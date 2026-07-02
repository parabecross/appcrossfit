"use client";

import { useTranslations } from "next-intl";
import { CalendarPlus, CalendarSearch, TrendingUp, Trophy } from "lucide-react";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function AthleteQuickActions({
  onBook,
  features,
  boxSlug,
}: {
  onBook: () => void;
  features: {
    reservas: boolean;
    ranking: boolean;
    progreso_atleta: boolean;
  };
  boxSlug: string;
}) {
  const t = useTranslations("socioHome.quickActions");

  const actions = [
    {
      key: "book",
      label: t("book"),
      icon: CalendarPlus,
      onClick: onBook,
      enabled: features.reservas,
      href: null as string | null,
    },
    {
      key: "schedule",
      label: t("schedule"),
      icon: CalendarSearch,
      onClick: onBook,
      enabled: features.reservas,
      href: null,
    },
    {
      key: "ranking",
      label: t("ranking"),
      icon: Trophy,
      onClick: undefined,
      enabled: features.ranking,
      href: `/ranking?box=${encodeURIComponent(boxSlug)}` as const,
    },
    {
      key: "progress",
      label: t("progress"),
      icon: TrendingUp,
      onClick: undefined,
      enabled: features.progreso_atleta,
      href: "/mi-progreso" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {actions.map(({ key, label, icon: Icon, onClick, enabled, href }) => {
        const inner = (
          <>
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl",
                enabled
                  ? "bg-orange-500/15 text-orange-400"
                  : "bg-white/5 text-muted-foreground/50"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <span
              className={cn(
                "text-sm font-semibold leading-tight",
                !enabled && "text-muted-foreground/60"
              )}
            >
              {label}
            </span>
          </>
        );

        const className = cn(
          "flex flex-col items-start gap-2.5 rounded-2xl border px-4 py-4 text-left transition-all",
          enabled
            ? "border-white/10 bg-white/[0.03] hover:border-orange-500/30 hover:bg-orange-500/5 active:scale-[0.98]"
            : "border-white/5 bg-transparent opacity-50 pointer-events-none"
        );

        if (href && enabled) {
          return (
            <Link key={key} href={href} className={className}>
              {inner}
            </Link>
          );
        }

        return (
          <button
            key={key}
            type="button"
            className={className}
            onClick={enabled ? onClick : undefined}
            disabled={!enabled}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
