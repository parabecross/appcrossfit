"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CupoProgress } from "@/components/clases/cupo-progress";
import { APP_CONFIG } from "@/lib/config/app-config";
import { canCancelReservation } from "@/lib/clases/helpers";
import { occupiedForSocioClass, isOptimisticReservaId } from "@/lib/reservas/helpers";
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
    if (isOptimisticReservaId(reserva.id)) return;

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
    <div className="rounded-xl border border-green-500/15 bg-green-500/[0.04] px-3 py-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{t("nextClass.label")}</p>
          <p className="text-base font-semibold leading-tight mt-0.5 truncate">
            {clase.nombre}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatShortDay(clase.fecha, locale)} · {formatTime(clase.hora_inicio)} –{" "}
            {formatTime(clase.hora_fin)}
            {clase.coach_nombre ? ` · ${clase.coach_nombre}` : ""}
          </p>
        </div>
        <Badge variant="success" className="shrink-0 text-[10px]">
          {t("nextClass.confirmed")}
        </Badge>
      </div>

      <CupoProgress occupied={occupied} max={clase.cupo_maximo} />

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg border-white/10 text-xs"
          disabled={!canCancel || loading || isOptimisticReservaId(reserva.id)}
          onClick={() => void handleCancel()}
        >
          {loading ? tc("loading") : t("nextClass.cancel")}
        </Button>
        {!canCancel && (
          <p className="text-[10px] text-muted-foreground leading-snug">
            {t("nextClass.cancelTooLate", { hours: APP_CONFIG.CANCELACION_HORAS })}
          </p>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
