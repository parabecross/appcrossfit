"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type {
  PointBreakdownDetail,
  PointBreakdownTotals,
} from "@/lib/ranking/point-breakdown";
import { hasPointBreakdown } from "@/lib/ranking/point-breakdown";

const TYPE_ORDER: (keyof PointBreakdownTotals)[] = [
  "attendance",
  "streak",
  "wod_position",
  "evolution",
  "achievement",
];

export function PointBreakdownChips({
  totals,
  className,
}: {
  totals: PointBreakdownTotals;
  className?: string;
}) {
  const t = useTranslations("rankingAthron");

  if (!hasPointBreakdown(totals)) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {TYPE_ORDER.map((type) => {
        const points = totals[type];
        if (points <= 0) return null;
        return (
          <span
            key={type}
            className="inline-flex items-center rounded-md bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-200/90 tabular-nums"
          >
            +{points} {t(`breakdownType.${type}`)}
          </span>
        );
      })}
    </div>
  );
}

export function PointBreakdownDetails({
  details,
  locale,
  className,
}: {
  details: PointBreakdownDetail[];
  locale: string;
  className?: string;
}) {
  const t = useTranslations("rankingAthron");
  const tb = useTranslations("progress.badges");

  if (details.length === 0) return null;

  return (
    <ul className={cn("space-y-1.5", className)}>
      {details.map((detail, index) => (
        <li
          key={`${detail.type}-${detail.fecha}-${index}`}
          className="flex items-start justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2 text-xs"
        >
          <div className="min-w-0">
            <p className="font-medium text-foreground/90">
              {formatDetailLabel(detail, t, tb)}
            </p>
            <p className="text-muted-foreground mt-0.5">
              {formatDetailDate(detail.fecha, locale)}
            </p>
          </div>
          <span className="shrink-0 font-bold text-orange-300 tabular-nums">
            +{detail.points}
          </span>
        </li>
      ))}
    </ul>
  );
}

function formatDetailDate(fecha: string, locale: string) {
  const d = new Date(`${fecha}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(d);
}

const EVOLUTION_REASON_KEYS = new Set([
  "first_rx",
  "personal_best_small",
  "personal_best_medium",
  "personal_best_large",
  "rank_improved_small",
  "rank_improved_medium",
  "rank_improved_large",
]);

function humanizeBadgeKey(badgeKey: string): string {
  return badgeKey
    .replace(/^skill_/, "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveBadgeLabel(
  badgeKey: string,
  tb: ReturnType<typeof useTranslations<"progress.badges">>
): string {
  if (tb.has(badgeKey as never)) {
    return tb(badgeKey as never);
  }
  return humanizeBadgeKey(badgeKey);
}

function formatDetailLabel(
  detail: PointBreakdownDetail,
  t: ReturnType<typeof useTranslations<"rankingAthron">>,
  tb: ReturnType<typeof useTranslations<"progress.badges">>
): string {
  const meta = detail.metadata;

  switch (detail.type) {
    case "attendance":
      return t("breakdownDetail.attendance");
    case "streak": {
      const days = meta.streak_days;
      return typeof days === "number"
        ? t("breakdownDetail.streakDays", { days })
        : t("breakdownDetail.streak");
    }
    case "wod_position": {
      const rank = meta.rank;
      const scoreDisplay =
        typeof meta.score_display === "string" ? meta.score_display : null;
      const scoreTipo =
        typeof meta.score_tipo === "string" ? meta.score_tipo : null;
      const claseNombre =
        typeof meta.clase_nombre === "string" ? meta.clase_nombre : null;
      const resultType =
        scoreTipo && t.has(`breakdownScoreType.${scoreTipo}` as never)
          ? t(`breakdownScoreType.${scoreTipo}` as never)
          : null;
      const base =
        typeof rank === "number" && resultType && scoreDisplay
          ? t("breakdownDetail.wodRankResult", {
              rank,
              resultType,
              result: scoreDisplay,
              className: claseNombre ?? t("breakdownDetail.wodClass"),
            })
          : typeof rank === "number"
            ? t("breakdownDetail.wodRank", {
                rank,
                className: claseNombre ?? t("breakdownDetail.wodClass"),
              })
            : t("breakdownDetail.wod");
      const rxBonus =
        typeof meta.rx_bonus === "number" && meta.rx_bonus > 0
          ? t("breakdownDetail.rxBonus", { points: meta.rx_bonus })
          : "";
      return rxBonus ? `${base} · ${rxBonus}` : base;
    }
    case "evolution": {
      const reason = typeof meta.reason === "string" ? meta.reason : "";
      if (EVOLUTION_REASON_KEYS.has(reason)) {
        return t(`breakdownDetail.evolution.${reason}` as "breakdownDetail.evolution.generic");
      }
      return t("breakdownDetail.evolution.generic");
    }
    case "achievement": {
      const badgeKey =
        typeof meta.badge_key === "string" ? meta.badge_key : null;
      if (badgeKey) {
        return t("breakdownDetail.achievement", {
          badge: resolveBadgeLabel(badgeKey, tb),
        });
      }
      return t("breakdownDetail.achievementGeneric");
    }
    default:
      return t("breakdownDetail.generic");
  }
}
