import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth/get-profile";
import { getBoxConfig } from "@/lib/box/config";
import { getDailyRankingForBox } from "@/lib/queries/daily-ranking";
import { DailyRankingView } from "@/components/ranking/daily-ranking-view";
import { RankingSharePanel } from "@/components/ranking/ranking-share-panel";

export default async function AdminRankingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireAdmin(locale);
  const boxConfig = await getBoxConfig(profile.box_id);
  const t = await getTranslations("scores");
  const tn = await getTranslations("nav");

  const data = await getDailyRankingForBox(boxConfig.slug);

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "https";
  const shareUrl = host
    ? `${proto}://${host}/${locale}/ranking`
    : `/${locale}/ranking`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black brand-text">{tn("ranking")}</h1>
        <p className="text-muted-foreground mt-1">{t("adminRankingSubtitle")}</p>
      </div>

      <RankingSharePanel shareUrl={shareUrl} locale={locale} />

      {data ? (
        <DailyRankingView data={data} locale={locale} />
      ) : (
        <p className="text-muted-foreground">{t("rankingUnavailable")}</p>
      )}
    </div>
  );
}
