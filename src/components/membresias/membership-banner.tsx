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
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
      <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
      <p className="text-sm text-red-200">{message}</p>
    </div>
  );
}
