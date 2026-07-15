"use client";

import { useTranslations } from "next-intl";

export function AthleteConstancyCard({
  classesThisWeek,
  classesThisMonth,
  streak,
}: {
  classesThisWeek: number;
  classesThisMonth: number;
  streak: number;
}) {
  const t = useTranslations("socioHome.constancy");

  const items = [
    { label: t("week"), value: classesThisWeek },
    { label: t("month"), value: classesThisMonth },
    { label: t("streak"), value: streak },
  ];

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("title")}
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl bg-white/[0.03] border border-white/10 px-2 py-3 text-center"
          >
            <p className="text-xl font-bold tabular-nums leading-none">
              {item.value}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
