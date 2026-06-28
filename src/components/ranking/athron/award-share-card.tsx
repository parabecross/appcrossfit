"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Share2, Trophy } from "lucide-react";
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

function previewScaleForStory(): number {
  if (typeof window === "undefined") return 0.28;
  const maxW = Math.min(window.innerWidth - 64, 300);
  return Math.min(maxW / 1080, 0.32);
}

function AwardCardArt({
  award,
  boxName,
  boxLogoUrl,
  monthLabel,
  label,
  leagueTitle,
  ptsLabel,
  avatarSrc,
  accent,
}: {
  award: MonthlyAwardResult;
  boxName: string;
  boxLogoUrl: string | null;
  monthLabel: string;
  label: string;
  leagueTitle: string;
  ptsLabel: string;
  avatarSrc: string;
  accent: string;
}) {
  return (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% 38%, rgba(249,115,22,0.22) 0%, transparent 55%), linear-gradient(180deg, #0c0a09 0%, #121214 55%, #0a0a0b 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-10 rounded-[2rem]"
        style={{ border: `2px solid ${accent}33` }}
      />
      <div
        className="pointer-events-none absolute inset-14 rounded-[1.5rem]"
        style={{ border: `1px solid ${accent}18` }}
      />

      <div
        className="relative flex flex-1 flex-col justify-between"
        style={{ padding: CARD_TYPO.pad }}
      >
        <div>
          <p
            className="font-bold uppercase tracking-[0.28em] text-orange-400"
            style={{ fontSize: CARD_TYPO.byAthron }}
          >
            {leagueTitle}
          </p>
          <p
            className="mt-3 capitalize text-white/55"
            style={{ fontSize: CARD_TYPO.discipline }}
          >
            {monthLabel}
          </p>
        </div>

        <div className="flex flex-col items-center text-center">
          <div
            className="mb-8 inline-flex items-center gap-3 rounded-full px-8 py-3"
            style={{
              background: `${accent}18`,
              border: `1px solid ${accent}44`,
            }}
          >
            <Trophy
              style={{ width: 28, height: 28, color: accent }}
              strokeWidth={2.25}
            />
            <span
              className="font-bold uppercase tracking-[0.16em] text-orange-200"
              style={{ fontSize: CARD_TYPO.statLabel + 2 }}
            >
              {label}
            </span>
          </div>

          <div className="relative mb-8">
            <div
              className="absolute inset-0 rounded-full blur-2xl"
              style={{
                background: `${accent}44`,
                transform: "scale(1.15)",
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarSrc}
              alt=""
              className="relative rounded-full object-cover"
              style={{
                width: 220,
                height: 220,
                border: `5px solid ${accent}66`,
                boxShadow: `0 0 0 8px ${accent}22, 0 24px 48px rgba(0,0,0,0.45)`,
              }}
              {...(!isLocalAvatarUrl(avatarSrc)
                ? { crossOrigin: "anonymous" as const }
                : {})}
            />
          </div>

          <p
            className="max-w-[90%] font-black leading-tight text-white"
            style={{ fontSize: CARD_TYPO.name, letterSpacing: "-0.02em" }}
          >
            {award.nombre}
          </p>

          <p
            className="mt-5 font-black tabular-nums text-orange-300"
            style={{ fontSize: CARD_TYPO.statValue + 8 }}
          >
            {award.points}
            <span
              className="ml-2 font-semibold text-white/50"
              style={{ fontSize: CARD_TYPO.statLabel + 4 }}
            >
              {ptsLabel}
            </span>
          </p>
        </div>

        <CardBrandingFooter
          boxName={boxName}
          boxLogoUrl={boxLogoUrl}
          accentColor={accent}
        />
      </div>
    </div>
  );
}

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
  const exportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.28);

  const labelKey = AWARD_LABELS[award.award_type] ?? "awardChampion";
  const accent = "#f97316";
  const avatarSrc = avatarUrlForAthlete(
    award.foto_url,
    award.usuario_id,
    award.nombre
  );

  const artProps = {
    award,
    boxName,
    boxLogoUrl,
    monthLabel,
    label: t(labelKey),
    leagueTitle: t("leagueTitle"),
    ptsLabel: t("pts"),
    avatarSrc,
    accent,
  };

  useEffect(() => {
    setPreviewScale(previewScaleForStory());
    const onResize = () => setPreviewScale(previewScaleForStory());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const exportCard = useCallback(async () => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await exportCardToPng(exportRef.current, "story");
      await sharePng(
        dataUrl,
        `athron-award-${award.award_type}.png`,
        t(labelKey)
      );
    } finally {
      setExporting(false);
    }
  }, [award.award_type, labelKey, t]);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 p-3">
        <CardExportShell
          format="story"
          accentColor={accent}
          previewScale={previewScale}
          className="mx-auto"
        >
          <AwardCardArt {...artProps} />
        </CardExportShell>
      </div>

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

      <div
        className="pointer-events-none fixed left-[-9999px] top-0 opacity-0"
        aria-hidden
      >
        <CardExportShell ref={exportRef} format="story" accentColor={accent}>
          <AwardCardArt {...artProps} />
        </CardExportShell>
      </div>
    </div>
  );
}
