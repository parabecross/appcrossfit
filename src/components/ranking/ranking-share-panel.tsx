"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check, Share2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";

export function RankingSharePanel({
  shareUrl,
  locale,
}: {
  shareUrl: string;
  locale: string;
}) {
  const t = useTranslations("scores");
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

  const whatsappText = encodeURIComponent(
    `${t("whatsappShareText")}\n${shareUrl}`
  );
  const whatsappUrl = `https://wa.me/?text=${whatsappText}`;

  return (
    <div className="rounded-2xl border border-orange-500/25 bg-orange-500/5 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Share2 className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-bold">{t("shareRankingTitle")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("shareRankingDesc")}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <code className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-orange-200/90 break-all">
          {shareUrl}
        </code>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          onClick={() => void copy()}
        >
          {copied ? (
            <Check className="h-4 w-4 mr-2 text-green-400" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          {copied ? t("linkCopied") : t("copyLink")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild className="rounded-xl">
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            {t("shareWhatsApp")}
          </a>
        </Button>
        <Button asChild variant="outline" className="rounded-xl">
          <Link href="/ranking" locale={locale} target="_blank">
            <ExternalLink className="h-4 w-4 mr-2" />
            {t("openPublicPage")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
