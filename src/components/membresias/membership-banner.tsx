"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface MembershipBannerProps {
  type: "pending" | "expired";
  expiryDate?: string;
  locale: string;
}

export function MembershipBanner({
  type,
  expiryDate,
  locale,
}: MembershipBannerProps) {
  const t = useTranslations("membership");

  const message =
    type === "pending"
      ? t("pending")
      : t("expired", {
          date: expiryDate ? formatDate(expiryDate, locale) : "—",
        });

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/20">
        <AlertTriangle className="h-4 w-4 text-orange-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-orange-200">
          {type === "pending" ? t("pendingTitle") : t("expiredTitle")}
        </p>
        <p className="text-sm text-orange-200/80 mt-0.5 leading-relaxed">
          {message}
        </p>
      </div>
    </div>
  );
}
