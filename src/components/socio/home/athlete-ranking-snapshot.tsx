"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { UserAthronSummary } from "@/lib/ranking/aggregate";
import { Badge } from "@/components/ui/badge";

/**
 * Compact ranking strip. Shows only real position + points.
 * Never invents "you went up/down" copy — deltas exist in the engine but
 * are not shown on Home without a clear product surface for them.
 */
export function AthleteRankingSnapshot({
  summary,
  locale,
  enabled,
  boxSlug,
}: {
  summary: UserAthronSummary | null;
  locale: string;
  enabled: boolean;
  boxSlug: string;
}) {
  const t = useTranslations("socioHome.ranking");

  if (!enabled) {
    return (
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("title")}
        </h2>
        <Link
          href={`/ranking?box=${encodeURIComponent(boxSlug)}`}
          locale={locale}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-11 inline-flex items-center text-xs font-semibold text-orange-400 hover:text-orange-300"
        >
          {t("viewRanking")}
        </Link>
      </div>

      <div className="rounded-xl bg-white/[0.03] border border-white/10 px-3 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-2xl font-bold tabular-nums leading-none">
            {summary?.month_rank != null
              ? t("rankPosition", { rank: summary.month_rank })
              : t("rankPending")}
          </p>
          <p className="text-sm text-muted-foreground mt-1.5">
            {t("monthPoints", { points: summary?.month_points ?? 0 })}
          </p>
        </div>
        {summary && summary.streak > 0 ? (
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {t("streak", { days: summary.streak })}
          </Badge>
        ) : null}
      </div>
    </section>
  );
}
