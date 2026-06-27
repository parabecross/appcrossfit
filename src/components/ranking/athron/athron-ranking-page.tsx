"use client";

import { useRouter, usePathname } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import type { AthronRankingData } from "@/lib/ranking/aggregate";
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
}: {
  data: AthronRankingData;
  locale: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const category = searchParams.get("category") ?? data.category;

  const monthLabel = new Date(`${data.month_key}-01`).toLocaleDateString(
    locale === "es" ? "es-MX" : "en-US",
    { month: "long", year: "numeric" }
  );

  const setCategory = (c: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", c);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-10 pb-16">
      <RankingHero
        boxName={data.box.name}
        logoUrl={data.box.logo_url}
        monthLabel={monthLabel}
        tagline={data.config.tagline}
      />

      <CategorySelector value={category} onChange={setCategory} />

      <PodiumTop3 rows={data.leaderboard} />

      <LeaderboardTable rows={data.leaderboard} />

      <DailyHistory days={data.daily_history} locale={locale} />

      <HowItWorks config={data.config} />

      <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground/60">
        Powered by ATHRON
      </p>
    </div>
  );
}
