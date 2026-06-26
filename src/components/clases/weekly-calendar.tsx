"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarX2, CheckCircle2 } from "lucide-react";
import { cn, formatTime, formatWeekdayShort } from "@/lib/utils";
import {
  getWeekDates,
  toDateString,
  canCancelReservation,
} from "@/lib/clases/helpers";
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
  const today = toDateString(new Date());
  const [selected, setSelected] = useState(today);
  const [localReservas, setLocalReservas] = useState(reservas);
  const [loading, setLoading] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    setLocalReservas(reservas);
  }, [reservas]);

  const dayClases = clases.filter(
    (c) => c.fecha === selected && c.estado === "programada"
  );

  const myReservation = (claseId: string) =>
    localReservas.find(
      (r) =>
        r.clase_id === claseId &&
        r.usuario_id === profileId &&
        ["confirmada", "asistio"].includes(r.estado)
    );

  const handleBook = async (claseId: string) => {
    setLoading(claseId);
    setCancelError(null);

    const tempId = `temp-${Date.now()}`;
    const optimistic: Reserva = {
      id: tempId,
      clase_id: claseId,
      usuario_id: profileId,
      estado: "confirmada",
      fecha_reserva: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    setLocalReservas((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from("reservas")
      .insert({
        clase_id: claseId,
        usuario_id: profileId,
        estado: "confirmada",
      })
      .select("*")
      .single();

    setLoading(null);

    if (error || !data) {
      setLocalReservas((prev) => prev.filter((r) => r.id !== tempId));
      return;
    }

    setLocalReservas((prev) =>
      prev.map((r) => (r.id === tempId ? data : r))
    );
    router.refresh();
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
    const previous = localReservas.find((r) => r.id === reservaId);
    setLocalReservas((prev) => prev.filter((r) => r.id !== reservaId));

    const { error } = await supabase
      .from("reservas")
      .update({ estado: "cancelada" })
      .eq("id", reservaId);

    setLoading(null);

    if (error && previous) {
      setLocalReservas((prev) => [...prev, previous]);
      return;
    }

    router.refresh();
  };

  const dayLabel = (d: Date) => formatWeekdayShort(d, locale);
  const isToday = (ds: string) => ds === today;

  const myBookingsToday = dayClases.filter((c) => myReservation(c.id)).length;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {week.map((d) => {
          const ds = toDateString(d);
          const isSelected = ds === selected;
          const count = clases.filter(
            (c) => c.fecha === ds && c.estado === "programada"
          ).length;
          return (
            <button
              key={ds}
              type="button"
              onClick={() => {
                setSelected(ds);
                setCancelError(null);
              }}
              className={cn(
                "relative flex shrink-0 flex-col items-center min-w-[56px] rounded-2xl px-3 py-2.5 text-xs font-semibold transition-all",
                isSelected
                  ? "brand-gradient text-white glow-primary"
                  : "bg-secondary/60 text-muted-foreground",
                isToday(ds) && !isSelected && "ring-1 ring-primary/40"
              )}
            >
              {dayLabel(d)}
              {count > 0 && (
                <span
                  className={cn(
                    "mt-0.5 text-[10px] font-normal",
                    isSelected ? "text-white/80" : "text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!isAdmin && myBookingsToday > 0 && (
        <div className="flex items-center gap-2 rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
          {t("bookedToday", { count: myBookingsToday })}
        </div>
      )}

      {cancelError && (
        <p className="text-sm text-orange-400 text-center rounded-xl bg-orange-500/10 px-4 py-3">
          {cancelError}
        </p>
      )}

      {dayClases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
          <CalendarX2 className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">{t("noClasses")}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {t("tryAnotherDay")}
          </p>
        </div>
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
                  "border-white/5 transition-all rounded-2xl overflow-hidden",
                  booked &&
                    !isAdmin &&
                    "ring-2 ring-green-500/40 border-green-500/30 bg-green-500/[0.03]",
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
                {booked && !isAdmin && (
                  <div className="bg-green-600/90 px-4 py-1.5 text-center text-xs font-semibold text-white">
                    {t("booked")}
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg leading-snug">
                      {clase.nombre}
                    </CardTitle>
                    <Badge
                      variant={full ? "destructive" : booked ? "success" : "secondary"}
                      className="shrink-0"
                    >
                      {full ? t("full") : booked ? t("booked") : t("status.programada")}
                    </Badge>
                  </div>
                  <p className="text-base font-medium text-foreground/90">
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
                <CardContent className="space-y-4 pb-5">
                  <CupoProgress occupied={occupied} max={clase.cupo_maximo} />
                  {!isAdmin && (
                    <>
                      {booked ? (
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            className="w-full h-12 rounded-xl text-base"
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
                            <p className="text-xs text-orange-400 text-center leading-relaxed">
                              {t("cancelTooLate", {
                                hours: APP_CONFIG.CANCELACION_HORAS,
                              })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <Button
                          className="w-full h-12 rounded-xl text-base font-semibold"
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
