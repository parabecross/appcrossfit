"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { formatShortDay, formatTime } from "@/lib/utils";
import { occupiedForSocioClass } from "@/lib/reservas/helpers";
import type { Clase, Reserva } from "@/types/database";
import type { Dispatch, SetStateAction } from "react";

export function AthleteAvailableClasses({
  classes,
  locale,
  canBook,
  reservas,
  serverReservas,
  profileId,
  onReservationsChange,
}: {
  classes: Clase[];
  locale: string;
  canBook: boolean;
  reservas: Reserva[];
  serverReservas: Reserva[];
  profileId: string;
  onReservationsChange?: Dispatch<SetStateAction<Reserva[]>>;
}) {
  const t = useTranslations("socioHome.available");
  const tc = useTranslations("common");
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const book = async (claseId: string) => {
    if (!canBook) return;
    setLoadingId(claseId);
    setError(null);
    const tempId = `temp-${claseId}`;
    const optimistic: Reserva = {
      id: tempId,
      clase_id: claseId,
      usuario_id: profileId,
      estado: "confirmada",
      fecha_reserva: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    onReservationsChange?.((prev) => [...prev, optimistic]);

    const res = await fetch("/api/reservas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clase_id: claseId }),
    });
    const payload = await res.json();
    setLoadingId(null);
    if (!res.ok) {
      onReservationsChange?.((prev) => prev.filter((r) => r.id !== tempId));
      setError(payload.error ?? tc("error"));
      return;
    }
    onReservationsChange?.((prev) =>
      prev.map((r) => (r.id === tempId ? (payload.reserva as Reserva) : r))
    );
    router.refresh();
  };

  return (
    <section id="horario" className="space-y-3 scroll-mt-24">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("title")}
      </h2>
      {classes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {classes.map((clase) => {
            const occupied = occupiedForSocioClass(
              clase.id,
              clase.cupo_ocupado ?? 0,
              reservas,
              serverReservas,
              profileId
            );
            const spots = Math.max(0, clase.cupo_maximo - occupied);
            return (
              <li
                key={clase.id}
                className="rounded-xl bg-white/[0.03] border border-white/10 px-3 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{clase.nombre}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatShortDay(clase.fecha, locale)} ·{" "}
                    {formatTime(clase.hora_inicio)}
                    {clase.coach_nombre ? ` · ${clase.coach_nombre}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                    {t("spots", { count: spots })}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="min-h-11 shrink-0 rounded-lg"
                  disabled={!canBook || loadingId === clase.id || spots <= 0}
                  onClick={() => void book(clase.id)}
                >
                  {loadingId === clase.id
                    ? tc("loading")
                    : !canBook
                      ? t("cannotBook")
                      : t("book")}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </section>
  );
}
