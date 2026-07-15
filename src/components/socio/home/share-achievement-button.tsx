"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { shareAchievement } from "@/lib/share/web-share";
import { Button } from "@/components/ui/button";

export function ShareAchievementButton({
  title,
  text,
  label,
}: {
  title: string;
  text: string;
  label: string;
}) {
  const t = useTranslations("socioHome.share");
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const onShare = async () => {
    const result = await shareAchievement({ title, text });
    if (result.ok && result.method === "clipboard") {
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 2000);
      return;
    }
    if (!result.ok && result.reason !== "aborted") {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 2000);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 rounded-lg border-white/10 text-xs"
        onClick={() => void onShare()}
      >
        {label}
      </Button>
      {status === "copied" ? (
        <span className="text-[11px] text-muted-foreground">{t("copied")}</span>
      ) : null}
      {status === "error" ? (
        <span className="text-[11px] text-red-400">{t("failed")}</span>
      ) : null}
    </div>
  );
}
