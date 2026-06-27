"use client";

import { useTranslations } from "next-intl";
import {
  CalendarCheck,
  Flame,
  Medal,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";
import type { RankingConfig } from "@/types/database";

export function HowItWorks({ config }: { config: RankingConfig }) {
  const t = useTranslations("rankingAthron");

  const items = [
    {
      icon: CalendarCheck,
      title: t("howAttendanceTitle"),
      desc: t("howAttendanceDesc", { points: config.attendance_points }),
    },
    {
      icon: Flame,
      title: t("howStreakTitle"),
      desc: t("howStreakDesc"),
    },
    {
      icon: Medal,
      title: t("howWodTitle"),
      desc: t("howWodDesc", {
        first: config.position_points_table[0] ?? 30,
        second: config.position_points_table[1] ?? 28,
        tenth: config.position_points_table[9] ?? 12,
        rxBonus: config.rx_bonus_points,
      }),
    },
    {
      icon: TrendingUp,
      title: t("howEvolutionTitle"),
      desc: t("howEvolutionDesc", {
        small: config.evolution_bonuses.small,
        large: config.evolution_bonuses.large,
      }),
    },
    {
      icon: Sparkles,
      title: t("howAchievementsTitle"),
      desc: t("howAchievementsDesc"),
    },
  ];

  return (
    <section className="space-y-6 py-8">
      <div className="text-center space-y-2">
        <Trophy className="h-8 w-8 text-orange-400 mx-auto" />
        <h2 className="text-xl font-bold">{t("howItWorksTitle")}</h2>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          {t("howItWorksSubtitle")}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="rounded-2xl border border-white/10 bg-card/40 p-5 space-y-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15">
              <Icon className="h-5 w-5 text-orange-400" />
            </div>
            <h3 className="font-bold">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
