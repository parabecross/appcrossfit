"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarClock, MapPin } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { CupoProgress } from "@/components/clases/cupo-progress";
import { CoachInfo } from "@/components/clases/coach-info";
import { APP_CONFIG } from "@/lib/config/app-config";
import { canCancelReservation } from "@/lib/clases/helpers";
import { countReservasForClase } from "@/lib/reservas/helpers";
import { formatShortDay, formatTime } from "@/lib/utils";
import type { Clase, Reserva } from "@/types/database";

export function AthleteNextClassCard({
  booking,
  locale,
  gymTimezone,
  reservas,
  onBookNow,
  canBook,
}: {
  booking: { clase: Clase; reserva: Reserva } | null;
  locale: string;
  gymTimezone?: string;
  reservas: Reserva[];
  onBookNow: () => void;
  canBook: boolean;
}) {
  const t = useTranslations("socioHome");
  const tc = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!booking) {
    return (
      <div className="rounded-3xl border border-dashed border-orange-500/30 bg-gradient-to-br from-orange-500/[0.08] to-transparent p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500/15">
            <CalendarClock className="h-6 w-6 text-orange-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-400/90">
              {t("nextClass.label")}
            </p>
            <h2 className="text-xl md:text-2xl font-black mt-1 leading-tight">
              {t("nextClass.emptyTitle")}
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              {t("nextClass.emptyDesc")}
            </p>
            {canBook && (
              <Button
                className="mt-4 h-11 rounded-xl font-semibold"
                onClick={onBookNow}
              >
                {t("nextClass.bookNow")}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const { clase, reserva } = booking;
  const occupied = countReservasForClase(reservas, clase.id);
  const canCancel = canCancelReservation(
    clase.fecha,
    clase.hora_inicio,
    gymTimezone
  );

  const handleCancel = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/reservas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reserva_id: reserva.id }),
    });
    const payload = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(payload.error ?? tc("error"));
      return;
    }
    router.refresh();
  };

  return (
    <div className="rounded-3xl border border-green-500/25 bg-gradient-to-br from-green-500/[0.12] via-card/80 to-card/60 p-6 md:p-8 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between gap-2 mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-green-400">
          {t("nextClass.label")}
        </p>
        <span className="rounded-full bg-green-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase text-green-300">
          {t("nextClass.confirmed")}
        </span>
      </div>

      <h2 className="text-2xl md:text-3xl font-black leading-tight">{clase.nombre}</h2>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground/90">
        <span className="font-semibold tabular-nums">
          {formatShortDay(clase.fecha, locale)} · {formatTime(clase.hora_inicio)} –{" "}
          {formatTime(clase.hora_fin)}
        </span>
      </div>

      {clase.coach_nombre && (
        <div className="mt-4">
          <CoachInfo
            nombre={clase.coach_nombre}
            fotoUrl={clase.coach_foto_url}
            bio={clase.coach_bio}
          />
        </div>
      )}

      <div className="mt-5">
        <CupoProgress occupied={occupied} max={clase.cupo_maximo} />
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-2">
        <Button
          variant="outline"
          className="flex-1 h-11 rounded-xl border-white/15"
          disabled={!canCancel || loading}
          onClick={() => void handleCancel()}
        >
          {loading ? tc("loading") : t("nextClass.cancel")}
        </Button>
        <Button
          variant="secondary"
          className="flex-1 h-11 rounded-xl"
          onClick={onBookNow}
        >
          <MapPin className="h-4 w-4 mr-1.5 opacity-70" />
          {t("nextClass.viewSchedule")}
        </Button>
      </div>

      {!canCancel && (
        <p className="text-xs text-orange-400 mt-3 text-center">
          {t("nextClass.cancelTooLate", { hours: APP_CONFIG.CANCELACION_HORAS })}
        </p>
      )}
      {error && (
        <p className="text-xs text-red-400 mt-2 text-center">{error}</p>
      )}
    </div>
  );
}
