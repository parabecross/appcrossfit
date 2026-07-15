"use client";

import { useState } from "react";
import {
  buildContextualWhatsAppMessage,
  buildWhatsAppUrl,
  type WhatsAppMessageType,
} from "@/lib/whatsapp";
import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { RegistrarSeguimientoDialog } from "@/components/admin/registrar-seguimiento-dialog";

/**
 * Opens WhatsApp with a contextual message. Does NOT auto-log contact —
 * when athleteId is set, offers an explicit "Register as contacted" action after open.
 */
export function WhatsAppReminderButton({
  phone,
  nombre,
  fechaFin,
  locale,
  type = "por_vencer",
  size = "sm",
  className,
  boxName,
  athleteId,
}: {
  phone: string | null | undefined;
  nombre: string;
  fechaFin?: string | null;
  locale: string;
  type?: WhatsAppMessageType;
  size?: "sm" | "default";
  className?: string;
  boxName?: string;
  athleteId?: string;
}) {
  const t = useTranslations("admin");
  const tseg = useTranslations("admin.athletesInbox.seguimiento");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [promptRegister, setPromptRegister] = useState(false);

  const message = buildContextualWhatsAppMessage(
    type,
    nombre,
    locale,
    boxName,
    fechaFin
  );
  const url = buildWhatsAppUrl(phone, message);

  if (!url) {
    return (
      <span className="text-xs text-muted-foreground">
        {t("noPhoneForWhatsApp")}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 items-stretch sm:items-end">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.stopPropagation();
          if (athleteId) setPromptRegister(true);
        }}
        className={className}
      >
        <Button
          type="button"
          size={size}
          variant="outline"
          className="gap-1.5 min-h-11 border-green-600/40 text-green-400 hover:bg-green-600/10 hover:text-green-300 w-full sm:w-auto"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </Button>
      </a>
      {athleteId && promptRegister ? (
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setRegisterOpen(true);
            }}
          >
            {tseg("registerAsContacted")}
          </Button>
          <RegistrarSeguimientoDialog
            athleteId={athleteId}
            athleteName={nombre}
            defaultTipo="whatsapp"
            defaultResultado="contacted"
            open={registerOpen}
            onOpenChange={(open) => {
              setRegisterOpen(open);
              if (!open) setPromptRegister(false);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
