"use client";

import { useRouter, usePathname } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import type { AthronRankingData } from "@/lib/ranking/aggregate";
import { formatMonthKeyLabel } from "@/lib/ranking/month";
import {
  RankingHero,
  CategorySelector,
  PodiumTop3,
} from "./ranking-hero";
import { LeaderboardTable } from "./leaderboard-table";
import { DailyHistory } from "./daily-history";
import { HowItWorks } from "./how-it-works";

export function AthronRankingPage({
  data,
  locale,
  availableMonths,
  viewerProfileId = null,
}: {
  data: AthronRankingData;
  locale: string;
  availableMonths: string[];
  viewerProfileId?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const category = searchParams.get("category") ?? data.category;

  const monthLabel = formatMonthKeyLabel(data.month_key, locale);
  const isCurrentMonth = data.month_key === data.current_month_key;

  const months =
    availableMonths.length > 0
      ? availableMonths
      : [data.current_month_key, data.month_key].filter(
          (v, i, arr) => arr.indexOf(v) === i
        );

  const replaceParams = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const setCategory = (c: string) => {
    replaceParams({ category: c });
  };

  const setMonth = (month: string) => {
    // Current month: omit from URL so default stays "actual".
    replaceParams({
      month: month === data.current_month_key ? null : month,
    });
  };

  return (
    <div className="space-y-10 pb-16">
      <RankingHero
        boxName={data.box.name}
        logoUrl={data.box.logo_url}
        monthLabel={monthLabel}
        tagline={data.config.tagline}
        isCurrentMonth={isCurrentMonth}
        monthKey={data.month_key}
        currentMonthKey={data.current_month_key}
        availableMonths={months}
        locale={locale}
        onMonthChange={setMonth}
      />

      <CategorySelector value={category} onChange={setCategory} />

      <PodiumTop3 rows={data.leaderboard} viewerProfileId={viewerProfileId} />

      <LeaderboardTable
        rows={data.leaderboard}
        locale={locale}
        viewerProfileId={viewerProfileId}
      />

      <DailyHistory
        key={`${data.month_key}-${category}`}
        days={data.daily_history}
        locale={locale}
      />

      <HowItWorks config={data.config} />

      <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground/60">
        Powered by ATHRON
      </p>
    </div>
  );
}
