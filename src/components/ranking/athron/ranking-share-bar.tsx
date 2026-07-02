"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";

export function RankingShareBar({
  shareUrl,
  previewHref,
  locale,
}: {
  shareUrl: string;
  previewHref: string;
  locale: string;
}) {
  const t = useTranslations("rankingAthron");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `${t("whatsappShare")}\n${shareUrl}`
  )}`;

  return (
    <div className="rounded-2xl border border-orange-500/25 bg-orange-500/5 p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
      <code className="flex-1 text-xs text-orange-200/90 break-all rounded-lg bg-black/30 px-3 py-2">
        {shareUrl}
      </code>
      <div className="flex gap-2 shrink-0">
        <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button asChild size="sm">
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <Share2 className="h-4 w-4 mr-1.5" />
            {t("share")}
          </a>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={previewHref} locale={locale} target="_blank">
            {t("preview")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
