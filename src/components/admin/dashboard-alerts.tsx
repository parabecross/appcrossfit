"use client";

import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { WhatsAppReminderButton } from "@/components/admin/whatsapp-reminder-button";
import type { AlertaMembresia } from "@/types/database";

export function ExpiringMembersList({
  items,
  locale,
  boxName,
}: {
  items: AlertaMembresia[];
  locale: string;
  boxName?: string;
}) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">—</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((a) => (
        <div
          key={a.profile_id}
          className="flex flex-col gap-2 rounded-xl bg-orange-500/10 border border-orange-500/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <Link
            href={`/admin/usuarios/${a.profile_id}`}
            className="min-w-0 hover:underline"
          >
            <span className="font-medium block truncate">{a.nombre_completo}</span>
            <Badge variant="warning" className="mt-1">
              {a.fecha_fin ? formatDate(a.fecha_fin, locale) : "—"}
            </Badge>
          </Link>
          {a.fecha_fin && (
            <WhatsAppReminderButton
              phone={a.telefono}
              nombre={a.nombre_completo}
              fechaFin={a.fecha_fin}
              locale={locale}
              type="por_vencer"
              boxName={boxName}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function ExpiredMembersList({
  items,
  locale,
  boxName,
}: {
  items: AlertaMembresia[];
  locale: string;
  boxName?: string;
}) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">—</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((a) => (
        <div
          key={a.profile_id}
          className="flex flex-col gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <Link
            href={`/admin/usuarios/${a.profile_id}`}
            className="min-w-0 hover:underline"
          >
            <span className="font-medium block truncate">{a.nombre_completo}</span>
            <span className="text-xs text-red-300 block mt-0.5">
              {a.fecha_fin
                ? formatDate(a.fecha_fin, locale)
                : "Sin membresía"}
            </span>
          </Link>
          {a.fecha_fin && (
            <WhatsAppReminderButton
              phone={a.telefono}
              nombre={a.nombre_completo}
              fechaFin={a.fecha_fin}
              locale={locale}
              type="vencida"
              boxName={boxName}
            />
          )}
        </div>
      ))}
    </div>
  );
}
