"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { BadgeStatus } from "@/lib/progreso/badges";

export function AthleteBadgesPreview({
  badges,
  locale,
}: {
  badges: BadgeStatus[];
  locale: string;
}) {
  const t = useTranslations("socioHome.badges");
  const tp = useTranslations("progress");

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
          {t("viewAll")}
        </Link>
      </div>
      {badges.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <li
              key={badge.key}
              className="rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-3 py-2 text-xs font-medium min-h-11 inline-flex items-center"
            >
              {tp(`badges.${badge.key}` as never)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
