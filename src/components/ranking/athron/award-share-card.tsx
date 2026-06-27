"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  avatarUrlForAthlete,
  isLocalAvatarUrl,
} from "@/lib/avatars/placeholder";
import {
  CardExportShell,
  CardBrandingFooter,
  CARD_TYPO,
} from "@/components/legacy/cards/card-export-shell";
import { exportCardToPng, sharePng } from "@/lib/legacy/export-card";
import type { MonthlyAwardResult } from "@/lib/ranking/awards";

const AWARD_LABELS: Record<string, string> = {
  champion: "awardChampion",
  athlete_of_month: "awardAthleteOfMonth",
  most_evolution: "awardMostEvolution",
  longest_streak: "awardLongestStreak",
  most_consistent: "awardMostConsistent",
};

export function AwardShareCard({
  award,
  boxName,
  boxLogoUrl,
  monthLabel,
}: {
  award: MonthlyAwardResult;
  boxName: string;
  boxLogoUrl: string | null;
  monthLabel: string;
  locale?: string;
}) {
  const t = useTranslations("rankingAthron");
  const ref = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const labelKey = AWARD_LABELS[award.award_type] ?? "awardChampion";
  const accent = "#f97316";
  const avatarSrc = avatarUrlForAthlete(
    award.foto_url,
    award.usuario_id,
    award.nombre
  );

  const exportCard = async () => {
    if (!ref.current) return;
    setExporting(true);
    try {
      const dataUrl = await exportCardToPng(ref.current, "story");
      await sharePng(
        dataUrl,
        `athron-award-${award.award_type}.png`,
        t(labelKey)
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <CardExportShell
        ref={ref}
        format="story"
        accentColor={accent}
        previewScale={0.35}
        className="mx-auto"
      >
        <div
          className="flex h-full flex-col justify-between p-10"
          style={{ background: "linear-gradient(160deg, #1a1208 0%, #121214 50%)" }}
        >
          <div>
            <p
              className="font-bold uppercase tracking-[0.2em] text-orange-400"
              style={{ fontSize: CARD_TYPO.byAthron }}
            >
              {t("leagueTitle")}
            </p>
            <p
              className="mt-2 text-white/60"
              style={{ fontSize: CARD_TYPO.discipline }}
            >
              {monthLabel}
            </p>
          </div>

          <div className="text-center space-y-4 py-8">
            <p
              className="font-bold uppercase tracking-wider text-orange-300"
              style={{ fontSize: CARD_TYPO.statLabel }}
            >
              {t(labelKey)}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarSrc}
              alt=""
              className="mx-auto rounded-full object-cover ring-4 ring-orange-500/40"
              style={{ width: 160, height: 160 }}
              {...(!isLocalAvatarUrl(avatarSrc)
                ? { crossOrigin: "anonymous" as const }
                : {})}
            />
            <p className="font-black text-white" style={{ fontSize: CARD_TYPO.name }}>
              {award.nombre}
            </p>
            <p
              className="font-bold text-orange-300 tabular-nums"
              style={{ fontSize: CARD_TYPO.statValue }}
            >
              {award.points} {t("pts")}
            </p>
          </div>

          <CardBrandingFooter
            boxName={boxName}
            boxLogoUrl={boxLogoUrl}
            accentColor={accent}
          />
        </div>
      </CardExportShell>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={exporting}
        onClick={() => void exportCard()}
      >
        {exporting ? (
          t("exporting")
        ) : (
          <>
            <Share2 className="h-4 w-4 mr-2" />
            {t("shareAward")}
          </>
        )}
      </Button>
    </div>
  );
}
