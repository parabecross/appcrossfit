"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarClock } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { CupoProgress } from "@/components/clases/cupo-progress";
import { APP_CONFIG } from "@/lib/config/app-config";
import { canCancelReservation } from "@/lib/clases/helpers";
import { occupiedForSocioClass } from "@/lib/reservas/helpers";
import { formatShortDay, formatTime } from "@/lib/utils";
import type { Clase, Reserva } from "@/types/database";
import type { Dispatch, SetStateAction } from "react";

export function AthleteNextClassCard({
  booking,
  locale,
  gymTimezone,
  reservas,
  serverReservas,
  profileId,
  onReservationsChange,
}: {
  booking: { clase: Clase; reserva: Reserva };
  locale: string;
  gymTimezone?: string;
  reservas: Reserva[];
  serverReservas: Reserva[];
  profileId: string;
  onReservationsChange?: Dispatch<SetStateAction<Reserva[]>>;
}) {
  const t = useTranslations("socioHome");
  const tc = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { clase, reserva } = booking;
  const occupied = occupiedForSocioClass(
    clase.id,
    clase.cupo_ocupado ?? 0,
    reservas,
    serverReservas,
    profileId
  );
  const canCancel = canCancelReservation(
    clase.fecha,
    clase.hora_inicio,
    gymTimezone
  );

  const handleCancel = async () => {
    setLoading(true);
    setError(null);
    const previous = reservas;
    onReservationsChange?.((prev) => prev.filter((r) => r.id !== reserva.id));
    const res = await fetch("/api/reservas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reserva_id: reserva.id }),
    });
    const payload = await res.json();
    setLoading(false);
    if (!res.ok) {
      onReservationsChange?.(previous);
      setError(payload.error ?? tc("error"));
      return;
    }
    router.refresh();
  };

  return (
    <div className="rounded-xl border border-green-500/20 bg-green-500/[0.06] px-3 py-3 space-y-2.5">
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-500/15">
          <CalendarClock className="h-4 w-4 text-green-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-green-400">
              {t("nextClass.label")}
            </p>
            <span className="rounded-md bg-green-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-green-300">
              {t("nextClass.confirmed")}
            </span>
          </div>
          <p className="text-sm font-bold leading-tight mt-0.5 truncate">
            {clase.nombre}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatShortDay(clase.fecha, locale)} · {formatTime(clase.hora_inicio)} –{" "}
            {formatTime(clase.hora_fin)}
            {clase.coach_nombre ? ` · ${clase.coach_nombre}` : ""}
          </p>
        </div>
      </div>

      <CupoProgress occupied={occupied} max={clase.cupo_maximo} />

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg border-white/10 text-xs"
          disabled={!canCancel || loading}
          onClick={() => void handleCancel()}
        >
          {loading ? tc("loading") : t("nextClass.cancel")}
        </Button>
        {!canCancel && (
          <p className="text-[10px] text-orange-400/90 leading-snug">
            {t("nextClass.cancelTooLate", { hours: APP_CONFIG.CANCELACION_HORAS })}
          </p>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
