"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_CONFIG } from "@/lib/config/app-config";
import { canCancelReservation } from "@/lib/clases/helpers";
import { isOptimisticReservaId } from "@/lib/reservas/helpers";
import { formatShortDay, formatTime } from "@/lib/utils";
import type { Clase, Reserva } from "@/types/database";
import type { Dispatch, SetStateAction } from "react";

export function AthleteNextClassCard({
  booking,
  locale,
  gymTimezone,
  reservas,
  profileId,
  onReservationsChange,
  onViewSchedule,
}: {
  booking: { clase: Clase; reserva: Reserva };
  locale: string;
  gymTimezone?: string;
  reservas: Reserva[];
  profileId: string;
  onReservationsChange?: Dispatch<SetStateAction<Reserva[]>>;
  onViewSchedule?: () => void;
}) {
  const t = useTranslations("socioHome");
  const tc = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { clase, reserva } = booking;
  void profileId;
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
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("nextClass.label")}
      </h2>
      <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 px-4 py-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold leading-tight truncate">
              {clase.nombre}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {formatShortDay(clase.fecha, locale)} · {formatTime(clase.hora_inicio)}
              {clase.coach_nombre ? ` · ${clase.coach_nombre}` : ""}
            </p>
          </div>
          <Badge variant="success" className="shrink-0 text-[10px]">
            {t("nextClass.confirmed")}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-lg border-white/10"
            onClick={() => {
              onViewSchedule?.();
              document.getElementById("horario")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
          >
            {t("nextClass.view")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 rounded-lg"
            disabled={!canCancel || loading || isOptimisticReservaId(reserva.id)}
            onClick={() => void handleCancel()}
          >
            {loading ? tc("loading") : t("nextClass.cancel")}
          </Button>
        </div>

        {!canCancel ? (
          <p className="text-[11px] text-muted-foreground">
            {t("nextClass.cancelTooLate", {
              hours: APP_CONFIG.CANCELACION_HORAS,
            })}
          </p>
        ) : null}
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
      </div>
    </section>
  );
}

export function AthleteNextClassEmpty({
  canBook,
}: {
  canBook: boolean;
}) {
  const t = useTranslations("socioHome");

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("nextClass.label")}
      </h2>
      <div className="rounded-2xl bg-white/[0.03] ring-1 ring-dashed ring-white/15 px-4 py-5 space-y-3">
        <div>
          <p className="text-base font-semibold">{t("nextClass.emptyTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("nextClass.emptyDesc")}
          </p>
        </div>
        <Button
          type="button"
          className="min-h-11 w-full sm:w-auto rounded-lg"
          disabled={!canBook}
          onClick={() =>
            document.getElementById("horario")?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            })
          }
        >
          {t("nextClass.bookNow")}
        </Button>
      </div>
    </section>
  );
}
