import { getTranslations } from "next-intl/server";
import { APP_CONFIG } from "@/lib/config/app-config";
import { getDailyRankingForBox } from "@/lib/queries/daily-ranking";
import { DailyRankingView } from "@/components/ranking/daily-ranking-view";

export default async function PublicRankingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("scores");
  const data = await getDailyRankingForBox(APP_CONFIG.DEFAULT_BOX_SLUG);

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <p className="text-muted-foreground">{t("rankingUnavailable")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
        <DailyRankingView data={data} locale={locale} showShareHint />
      </div>
    </div>
  );
}
