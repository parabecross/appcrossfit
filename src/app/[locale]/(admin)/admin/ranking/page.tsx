import { headers } from "next/headers";

import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth/get-profile";
import { getBoxConfig } from "@/lib/box/config";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { FeatureGate } from "@/components/plans/feature-gate";
import { getRankingConfig } from "@/lib/ranking/engine";
import { getAthronRankingForBox } from "@/lib/ranking/aggregate";
import { computeMonthlyAwards } from "@/lib/ranking/awards";
import {
  buildPublicRankingPreviewPath,
  buildPublicRankingUrl,
} from "@/lib/ranking/public-url";
import { AthronRankingPage } from "@/components/ranking/athron/athron-ranking-page";
import { RankingShareBar } from "@/components/ranking/athron/ranking-share-bar";
import { RankingConfigForm } from "@/components/ranking/athron/ranking-config-form";
import { MonthlyAwards } from "@/components/ranking/athron/monthly-awards";
import { AwardShareCard } from "@/components/ranking/athron/award-share-card";
import { AdminRankingTabs } from "@/components/ranking/athron/admin-ranking-tabs";
import type { AthleticLevel } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminRankingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const profile = await requireAdmin(locale);
  const boxConfig = await getBoxConfig(profile.box_id);
  const entitlements = await getBoxEntitlements(profile.box_id!);
  const t = await getTranslations("rankingAthron");
  const tn = await getTranslations("nav");

  const category = (
    ["beginner", "intermediate", "advanced", "rx"].includes(sp.category ?? "")
      ? sp.category
      : "intermediate"
  ) as AthleticLevel;

  const monthKey = new Date().toISOString().slice(0, 7);
  const monthLabel = new Date(`${monthKey}-01`).toLocaleDateString(
    locale === "es" ? "es-MX" : "en-US",
    { month: "long", year: "numeric" }
  );

  const [config, data, awards] = await Promise.all([
    getRankingConfig(profile.box_id!),
    getAthronRankingForBox({
      boxSlug: boxConfig.slug,
      category,
    }),
    computeMonthlyAwards({
      boxSlug: boxConfig.slug,
      monthKey,
      category,
    }),
  ]);

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "https";
  const shareUrl = buildPublicRankingUrl({
    locale,
    boxSlug: boxConfig.slug,
    category,
    host,
    proto,
  });
  const previewHref = buildPublicRankingPreviewPath({
    boxSlug: boxConfig.slug,
    category,
  });

  const shareableAwards = awards.filter((a) => a.award_type !== "top3");

  return (
    <FeatureGate
      entitlements={entitlements}
      featureKey="ranking"
      title={tn("ranking")}
      description={t("adminSubtitle")}
    >
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black brand-text">{tn("ranking")}</h1>
        <p className="text-muted-foreground mt-1">{t("adminSubtitle")}</p>
      </div>

      <AdminRankingTabs
        preview={
          data ? (
            <div className="space-y-6">
              <AthronRankingPage data={data} locale={locale} />
              <MonthlyAwards awards={awards} locale={locale} />
            </div>
          ) : (
            <p className="text-muted-foreground">{t("unavailable")}</p>
          )
        }
        config={<RankingConfigForm initial={config} />}
        share={
          <div className="space-y-8">
            <RankingShareBar
              shareUrl={shareUrl}
              previewHref={previewHref}
              locale={locale}
            />
            <MonthlyAwards awards={awards} locale={locale} />
            {shareableAwards.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold">{t("shareAwards")}</h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {shareableAwards.slice(0, 3).map((award) => (
                    <AwardShareCard
                      key={`${award.award_type}-${award.usuario_id}`}
                      award={award}
                      boxName={boxConfig.name}
                      boxLogoUrl={boxConfig.logoUrl}
                      monthLabel={monthLabel}
                      locale={locale}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        }
      />
    </div>
    </FeatureGate>
  );
}
