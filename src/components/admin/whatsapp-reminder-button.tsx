"use client";

import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  buildRenewalReminderMessage,
  buildWhatsAppUrl,
} from "@/lib/whatsapp";

export function WhatsAppReminderButton({
  phone,
  nombre,
  fechaFin,
  locale,
  type = "por_vencer",
  size = "sm",
  className,
}: {
  phone: string | null | undefined;
  nombre: string;
  fechaFin: string;
  locale: string;
  type?: "por_vencer" | "vencida";
  size?: "sm" | "default";
  className?: string;
}) {
  const t = useTranslations("admin");
  const message = buildRenewalReminderMessage(nombre, fechaFin, locale, type);
  const url = buildWhatsAppUrl(phone, message);

  if (!url) {
    return (
      <span className="text-xs text-muted-foreground">{t("noPhoneForWhatsApp")}</span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={className}
    >
      <Button
        type="button"
        size={size}
        variant="outline"
        className="gap-1.5 border-green-600/40 text-green-400 hover:bg-green-600/10 hover:text-green-300"
      >
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </Button>
    </a>
  );
}
