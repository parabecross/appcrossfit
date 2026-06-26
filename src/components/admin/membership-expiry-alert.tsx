"use client";

import { Clock, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatDate } from "@/lib/utils";
import { daysUntilExpiry } from "@/lib/whatsapp";
import { WhatsAppReminderButton } from "@/components/admin/whatsapp-reminder-button";

export function MembershipExpiryAlert({
  nombre,
  telefono,
  fechaFin,
  locale,
}: {
  nombre: string;
  telefono: string | null;
  fechaFin: string;
  locale: string;
}) {
  const t = useTranslations("admin");
  const tm = useTranslations("membership");
  const days = daysUntilExpiry(fechaFin);
  const expired = days < 0;
  const expiringSoon = days >= 0 && days <= 3;

  if (!expired && !expiringSoon) return null;

  const type = expired ? "vencida" : "por_vencer";

  return (
    <div
      className={
        expired
          ? "flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4"
          : "flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4"
      }
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {expired ? (
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
        ) : (
          <Clock className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0">
          <p
            className={`text-sm font-semibold ${expired ? "text-red-200" : "text-orange-200"}`}
          >
            {expired ? t("membershipExpiredAlert") : t("membershipExpiringAlert")}
          </p>
          <p
            className={`text-sm mt-0.5 ${expired ? "text-red-200/80" : "text-orange-200/80"}`}
          >
            {expired
              ? tm("expired", { date: formatDate(fechaFin, locale) })
              : t("expiresInDays", { days })}
          </p>
        </div>
      </div>
      <WhatsAppReminderButton
        phone={telefono}
        nombre={nombre}
        fechaFin={fechaFin}
        locale={locale}
        type={type}
        className="shrink-0"
      />
    </div>
  );
}
