"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { formatPrValue } from "@/lib/progreso/helpers";
import type { HomeProgressSnapshot } from "@/lib/socio/home-snapshot";
import { ShareAchievementButton } from "@/components/socio/home/share-achievement-button";

export function AthleteProgressSnapshot({
  snapshot,
  locale,
}: {
  snapshot: HomeProgressSnapshot;
  locale: string;
}) {
  const t = useTranslations("socioHome.progress");

  const rows: { label: string; value: string }[] = [];
  if (snapshot.lastPr) {
    rows.push({
      label: t("lastPr"),
      value: `${snapshot.lastPr.ejercicio.replace(/_/g, " ")} · ${formatPrValue(Number(snapshot.lastPr.valor), snapshot.lastPr.unidad)}`,
    });
  }
  if (snapshot.lastRm) {
    rows.push({
      label: t("lastRm"),
      value: `${snapshot.lastRm.ejercicio.replace(/_/g, " ")} · ${formatPrValue(Number(snapshot.lastRm.valor), snapshot.lastRm.unidad)}`,
    });
  }
  if (snapshot.lastSkill) {
    rows.push({
      label: t("lastSkill"),
      value: `${String(snapshot.lastSkill.skill).replace(/_/g, " ")} · ${snapshot.lastSkill.estado}`,
    });
  }

  const shareText =
    rows.length > 0
      ? rows.map((r) => `${r.label}: ${r.value}`).join("\n")
      : t("emptyShare");

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("title")}
        </h2>
        <Link
          href="/mi-progreso"
          locale={locale}
          className="min-h-11 inline-flex items-center text-xs font-semibold text-orange-400 hover:text-orange-300"
        >
          {t("viewProgress")}
        </Link>
      </div>

      <div className="rounded-xl bg-white/[0.03] border border-white/10 px-3 py-3 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold tabular-nums">{snapshot.prCount}</p>
            <p className="text-[10px] text-muted-foreground">{t("prs")}</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">{snapshot.skillCount}</p>
            <p className="text-[10px] text-muted-foreground">{t("skills")}</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">{snapshot.badgeCount}</p>
            <p className="text-[10px] text-muted-foreground">{t("badges")}</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((row) => (
              <li
                key={row.label}
                className="flex items-baseline justify-between gap-2 text-sm"
              >
                <span className="text-muted-foreground shrink-0">{row.label}</span>
                <span className="truncate text-right font-medium capitalize">
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
        )}

        <ShareAchievementButton
          title={t("shareTitle")}
          text={shareText}
          label={t("share")}
        />
      </div>
    </section>
  );
}
