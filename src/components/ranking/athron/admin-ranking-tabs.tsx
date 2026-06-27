"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function AdminRankingTabs({
  preview,
  config,
  share,
}: {
  preview: ReactNode;
  config: ReactNode;
  share: ReactNode;
}) {
  const t = useTranslations("rankingAthron");
  const [tab, setTab] = useState<"preview" | "config" | "share">("preview");

  const tabs = [
    { id: "preview" as const, label: t("tabPreview") },
    { id: "config" as const, label: t("tabConfig") },
    { id: "share" as const, label: t("tabShare") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              tab === id
                ? "bg-orange-500/20 text-orange-300"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "preview" && preview}
      {tab === "config" && config}
      {tab === "share" && share}
    </div>
  );
}
