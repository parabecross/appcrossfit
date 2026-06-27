"use client";

import { useTranslations } from "next-intl";
import { AthronPointsWidget } from "@/components/ranking/athron/athron-points-widget";
import type { UserAthronSummary } from "@/lib/ranking/aggregate";

export function AthronProgressSection({
  summary,
  locale,
}: {
  summary: UserAthronSummary;
  locale: string;
}) {
  const t = useTranslations("rankingAthron");

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">{t("sectionTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("sectionSubtitle")}</p>
      </div>
      <AthronPointsWidget
        monthPoints={summary.month_points}
        todayPoints={summary.today_points}
        monthRank={summary.month_rank}
        streak={summary.streak}
        category={summary.category}
        locale={locale}
      />
      <p className="text-xs text-muted-foreground text-center">
        {t("monthAttendances", { count: summary.attendances })}
      </p>
    </section>
  );
}
