import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { APP_CONFIG } from "@/lib/config/app-config";
import { getAthronRankingForBox } from "@/lib/ranking/aggregate";
import { AthronRankingPage } from "@/components/ranking/athron/athron-ranking-page";
import type { AthleticLevel } from "@/types/database";

export default async function PublicRankingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; month?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations("rankingAthron");

  const category = (
    ["beginner", "intermediate", "advanced", "rx"].includes(
      sp.category ?? ""
    )
      ? sp.category
      : "intermediate"
  ) as AthleticLevel;

  const data = await getAthronRankingForBox({
    boxSlug: APP_CONFIG.DEFAULT_BOX_SLUG,
    monthKey: sp.month,
    category,
  });

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <p className="text-muted-foreground">{t("unavailable")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
        <Suspense fallback={null}>
          <AthronRankingPage data={data} locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}
