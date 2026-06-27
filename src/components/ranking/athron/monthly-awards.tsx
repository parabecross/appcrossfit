"use client";

import { useTranslations } from "next-intl";
import { AthleteAvatar } from "@/components/ui/athlete-avatar";
import type { MonthlyAwardResult } from "@/lib/ranking/awards";

const AWARD_LABELS: Record<string, string> = {
  champion: "awardChampion",
  top3: "awardTop3",
  athlete_of_month: "awardAthleteOfMonth",
  most_evolution: "awardMostEvolution",
  longest_streak: "awardLongestStreak",
  most_consistent: "awardMostConsistent",
};

export function MonthlyAwards({
  awards,
}: {
  awards: MonthlyAwardResult[];
  locale?: string;
}) {
  const t = useTranslations("rankingAthron");

  if (awards.length === 0) return null;

  const byType = new Map<string, MonthlyAwardResult>();
  for (const a of awards) {
    if (a.award_type === "top3") continue;
    byType.set(a.award_type, a);
  }

  const display = Array.from(byType.values());

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold">{t("monthlyAwards")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {display.map((award) => (
          <div
            key={award.id + award.award_type}
            className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-transparent p-4 flex items-center gap-4"
          >
            <AthleteAvatar
              fotoUrl={award.foto_url}
              seed={award.usuario_id}
              name={award.nombre}
              className="h-14 w-14 ring-2 ring-orange-500/30"
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-orange-400">
                {t(AWARD_LABELS[award.award_type] ?? "awardChampion")}
              </p>
              <p className="font-bold text-lg">{award.nombre}</p>
              <p className="text-xs text-muted-foreground">
                {award.points} {t("pts")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
