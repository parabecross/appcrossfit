"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn, formatTime, formatWeekdayShort } from "@/lib/utils";
import { getWeekDates, toDateString, canCancelReservation } from "@/lib/clases/helpers";
import { APP_CONFIG } from "@/lib/config/app-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CupoProgress } from "@/components/clases/cupo-progress";
import { CoachInfo } from "@/components/clases/coach-info";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/routing";
import type { Clase, Reserva } from "@/types/database";

interface WeeklyCalendarProps {
  clases: Clase[];
  reservas: Reserva[];
  profileId: string;
  canBook: boolean;
  locale: string;
  isAdmin?: boolean;
  onClassSelect?: (claseId: string) => void;
  selectedClaseId?: string | null;
}

export function WeeklyCalendar({
  clases,
  reservas,
  profileId,
  canBook,
  locale,
  isAdmin = false,
  onClassSelect,
  selectedClaseId,
}: WeeklyCalendarProps) {
  const t = useTranslations("classes");
  const tc = useTranslations("common");
  const router = useRouter();
  const supabase = createClient();
  const week = getWeekDates();
  const [selected, setSelected] = useState(toDateString(new Date()));
  const [loading, setLoading] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const dayClases = clases.filter((c) => c.fecha === selected && c.estado === "programada");

  const myReservation = (claseId: string) =>
    reservas.find(
      (r) =>
        r.clase_id === claseId &&
        r.usuario_id === profileId &&
        ["confirmada", "asistio"].includes(r.estado)
    );

  const handleBook = async (claseId: string) => {
    setLoading(claseId);
    await supabase.from("reservas").insert({
      clase_id: claseId,
      usuario_id: profileId,
      estado: "confirmada",
    });
    router.refresh();
    setLoading(null);
  };

  const handleCancel = async (
    reservaId: string,
    claseFecha: string,
    horaInicio: string
  ) => {
    if (!canCancelReservation(claseFecha, horaInicio)) {
      setCancelError(
        t("cancelTooLate", { hours: APP_CONFIG.CANCELACION_HORAS })
      );
      return;
    }
    setCancelError(null);
    setLoading(reservaId);
    await supabase
      .from("reservas")
      .update({ estado: "cancelada" })
      .eq("id", reservaId);
    router.refresh();
    setLoading(null);
  };

  const dayLabel = (d: Date) => formatWeekdayShort(d, locale);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {week.map((d) => {
          const ds = toDateString(d);
          const isSelected = ds === selected;
          return (
            <button
              key={ds}
              type="button"
              onClick={() => setSelected(ds)}
              className={cn(
                "flex shrink-0 flex-col items-center min-w-[56px] rounded-2xl px-3 py-2.5 text-xs font-semibold transition-all",
                isSelected
                  ? "brand-gradient text-white glow-primary"
                  : "bg-secondary/60 text-muted-foreground"
              )}
            >
              {dayLabel(d)}
            </button>
          );
        })}
      </div>

      {cancelError && (
        <p className="text-sm text-orange-400 text-center">{cancelError}</p>
      )}

      {dayClases.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">{t("noClasses")}</p>
      ) : (
        <div className="grid gap-3 md:gap-4 md:grid-cols-2">
          {dayClases.map((clase) => {
            const occupied = clase.cupo_ocupado ?? 0;
            const full = occupied >= clase.cupo_maximo;
            const reservation = myReservation(clase.id);
            const booked = !!reservation;
            const canCancel = booked
              ? canCancelReservation(clase.fecha, clase.hora_inicio)
              : false;

            return (
              <Card
                key={clase.id}
                className={cn(
                  "border-white/5 transition-all rounded-2xl",
                  isAdmin &&
                    onClassSelect &&
                    selectedClaseId === clase.id &&
                    "ring-2 ring-primary/50 border-primary/30",
                  isAdmin && onClassSelect && "cursor-pointer active:scale-[0.99]"
                )}
                onClick={
                  isAdmin && onClassSelect
                    ? () => onClassSelect(clase.id)
                    : undefined
                }
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{clase.nombre}</CardTitle>
                    <Badge variant={full ? "destructive" : "success"}>
                      {full ? t("full") : t("status.programada")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatTime(clase.hora_inicio)} – {formatTime(clase.hora_fin)}
                  </p>
                  {clase.coach_nombre && (
                    <CoachInfo
                      nombre={clase.coach_nombre}
                      fotoUrl={clase.coach_foto_url}
                      bio={clase.coach_bio}
                    />
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <CupoProgress occupied={occupied} max={clase.cupo_maximo} />
                  {!isAdmin && (
                    <>
                      {booked ? (
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            className="w-full"
                            disabled={
                              !canCancel || loading === reservation?.id
                            }
                            onClick={() =>
                              handleCancel(
                                reservation!.id,
                                clase.fecha,
                                clase.hora_inicio
                              )
                            }
                          >
                            {loading === reservation?.id
                              ? tc("loading")
                              : t("cancelBooking")}
                          </Button>
                          {!canCancel && (
                            <p className="text-xs text-orange-400 text-center">
                              {t("cancelTooLate", {
                                hours: APP_CONFIG.CANCELACION_HORAS,
                              })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <Button
                          className="w-full"
                          disabled={!canBook || full || loading === clase.id}
                          onClick={() => handleBook(clase.id)}
                        >
                          {loading === clase.id
                            ? tc("loading")
                            : full
                              ? t("full")
                              : t("book")}
                        </Button>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
