import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { getPublicRankingAccess } from "@/lib/entitlements/engine";
import {
  getAthronRankingForBox,
  listAvailableRankingMonthKeys,
} from "@/lib/ranking/aggregate";
import { isValidMonthKey } from "@/lib/ranking/month";
import { AthronRankingPage } from "@/components/ranking/athron/athron-ranking-page";
import { createClient } from "@/lib/supabase/server";
import type { AthleticLevel } from "@/types/database";

export const dynamic = "force-dynamic";

function RankingUnavailable({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <p className="text-muted-foreground text-center max-w-md">{message}</p>
    </div>
  );
}

async function resolveViewerProfileId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    return profile?.id ?? null;
  } catch {
    return null;
  }
}

export default async function PublicRankingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    category?: string;
    month?: string;
    box?: string;
  }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations("rankingAthron");
  const boxSlug = sp.box?.trim();

  if (!boxSlug) {
    return <RankingUnavailable message={t("missingBoxParam")} />;
  }

  const access = await getPublicRankingAccess(boxSlug);
  if (!access.allowed) {
    return <RankingUnavailable message={t("unavailableForBox")} />;
  }

  const category = (
    ["beginner", "intermediate", "advanced", "rx"].includes(
      sp.category ?? ""
    )
      ? sp.category
      : "intermediate"
  ) as AthleticLevel;

  const monthKey = isValidMonthKey(sp.month) ? sp.month : undefined;

  const [data, viewerProfileId] = await Promise.all([
    getAthronRankingForBox({
      boxSlug,
      monthKey,
      category,
    }),
    resolveViewerProfileId(),
  ]);

  if (!data) {
    return <RankingUnavailable message={t("unavailable")} />;
  }

  const availableMonths = await listAvailableRankingMonthKeys({
    boxId: data.box.id,
    timezone: data.box.timezone,
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
        <Suspense fallback={null}>
          <AthronRankingPage
            data={data}
            locale={locale}
            availableMonths={availableMonths}
            viewerProfileId={viewerProfileId}
          />
        </Suspense>
      </div>
    </div>
  );
}
