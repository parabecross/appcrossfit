"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarX2, CheckCircle2 } from "lucide-react";
import { cn, formatTime, formatWeekdayShort, formatShortDay } from "@/lib/utils";
import {
  getClassDates,
  toDateString,
  todayInTimezone,
  addDaysToDateString,
  canCancelReservation,
  canBookClass,
  filterClassesForSocio,
  hasClassEnded,
} from "@/lib/clases/helpers";
import {
  getClassTimeBlock,
  type ClassTimeBlock,
} from "@/lib/clases/workout-summary";
import { AdminClassCardCompact } from "@/components/admin/clases/admin-class-card-compact";
import { AdminClassListRow } from "@/components/admin/clases/admin-class-list-row";
import type { AdminClassesViewMode } from "@/components/admin/clases/admin-classes-toolbar";
import { ScoreEntryForm } from "@/components/clases/score-entry-form";
import { ScoreResponseSummary } from "@/components/clases/score-response-summary";
import { AthronPointsWidget } from "@/components/ranking/athron/athron-points-widget";
import { hasScoreResponse } from "@/lib/scores/helpers";
import type { ClaseScoreWithProfile } from "@/lib/queries/class-scores";
import type { UserAthronSummary } from "@/lib/ranking/aggregate";
import { APP_CONFIG } from "@/lib/config/app-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CupoProgress } from "@/components/clases/cupo-progress";
import { CoachInfo } from "@/components/clases/coach-info";
import { WorkoutBlock } from "@/components/clases/workout-block";
import { DeleteClaseDialog } from "@/components/admin/delete-clase-dialog";
import { EditClaseDialog } from "@/components/admin/edit-clase-dialog";
import { countReservasForClase, countUpcomingActiveReservasForUser, hasReachedFutureReservaLimit, isActiveReserva, isOptimisticReservaId, occupiedForSocioClass, RESERVA_LIMITE_MAX_CODE } from "@/lib/reservas/helpers";
import { useRouter } from "@/i18n/routing";
import type { Clase, Profile, Reserva, AthleticLevel } from "@/types/database";
import type { Dispatch, SetStateAction } from "react";

interface WeeklyCalendarProps {
  clases: Clase[];
  reservas: Reserva[];
  serverReservas?: Reserva[];
  onReservationsChange?: Dispatch<SetStateAction<Reserva[]>>;
  profileId: string;
  canBook: boolean;
  locale: string;
  isAdmin?: boolean;
  onClassSelect?: (claseId: string) => void;
  onDayChange?: (date: string) => void;
  selectedClaseId?: string | null;
  onClassDeleted?: (claseId: string) => void;
  onClassUpdated?: (clase: Clase) => void;
  focusDate?: string | null;
  coaches?: Profile[];
  canEditClass?: boolean;
  gymTimezone?: string;
  classScores?: ClaseScoreWithProfile[];
  athleteLevel?: AthleticLevel | null;
  athronSummary?: UserAthronSummary | null;
  hideRankingWidget?: boolean;
  adminViewMode?: AdminClassesViewMode;
  adminSearch?: string;
  adminCoachFilter?: string;
}

export function WeeklyCalendar({
  clases,
  reservas,
  serverReservas = reservas,
  onReservationsChange,
  profileId,
  canBook,
  locale,
  isAdmin = false,
  onClassSelect,
  onDayChange,
  selectedClaseId,
  onClassDeleted,
  onClassUpdated,
  focusDate,
  coaches = [],
  canEditClass = false,
  gymTimezone,
  classScores = [],
  athronSummary,
  hideRankingWidget = false,
  adminViewMode = "cards",
  adminSearch = "",
  adminCoachFilter = "all",
}: WeeklyCalendarProps) {
  const t = useTranslations("classes");
  const tc = useTranslations("common");
  const router = useRouter();
  const today = gymTimezone
    ? todayInTimezone(gymTimezone)
    : toDateString(new Date());
  const tomorrow = addDaysToDateString(today, 1);
  const displayClases = useMemo(
    () => (isAdmin ? clases : filterClassesForSocio(clases, gymTimezone)),
    [clases, isAdmin, gymTimezone]
  );
  const daysWithClasses = useMemo(() => getClassDates(displayClases), [displayClases]);
  const [selected, setSelected] = useState(today);
  const controlled = !!onReservationsChange;
  const [uncontrolledReservas, setUncontrolledReservas] = useState(reservas);
  const [loading, setLoading] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);

  const localReservas = controlled ? reservas : uncontrolledReservas;
  const updateReservas = controlled ? onReservationsChange! : setUncontrolledReservas;
  const effectiveTimezone = gymTimezone ?? APP_CONFIG.GYM_TIMEZONE;

  const clasesById = useMemo(
    () =>
      new Map(
        clases.map((c) => [c.id, { fecha: c.fecha, hora_fin: c.hora_fin }])
      ),
    [clases]
  );

  const upcomingReservationCount = useMemo(
    () =>
      !isAdmin
        ? countUpcomingActiveReservasForUser(
            localReservas,
            profileId,
            clasesById,
            effectiveTimezone
          )
        : 0,
    [isAdmin, localReservas, profileId, clasesById, effectiveTimezone]
  );

  const atReservationLimit =
    !isAdmin &&
    hasReachedFutureReservaLimit(
      localReservas,
      profileId,
      clasesById,
      effectiveTimezone,
      APP_CONFIG.MAX_SOCIO_FUTURE_RESERVAS
    );

  useEffect(() => {
    if (!controlled) {
      setUncontrolledReservas(reservas);
    }
  }, [reservas, controlled]);

  useEffect(() => {
    if (daysWithClasses.length === 0) return;
    if (!daysWithClasses.includes(selected)) {
      setSelected(daysWithClasses[0]);
    }
  }, [daysWithClasses, selected]);

  useEffect(() => {
    if (focusDate) setSelected(focusDate);
  }, [focusDate]);

  const dayClases = useMemo(() => {
    let list = displayClases.filter(
      (c) => c.fecha === selected && c.estado === "programada"
    );

    if (isAdmin) {
      if (adminSearch.trim()) {
        const q = adminSearch.trim().toLowerCase();
        list = list.filter((c) => c.nombre.toLowerCase().includes(q));
      }
      if (adminCoachFilter !== "all") {
        list = list.filter((c) => c.coach_id === adminCoachFilter);
      }
    }

    return list.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  }, [
    displayClases,
    selected,
    isAdmin,
    adminSearch,
    adminCoachFilter,
  ]);

  const adminGroupedClases = useMemo(() => {
    if (!isAdmin) return [];
    const blocks: ClassTimeBlock[] = ["morning", "afternoon", "evening"];
    return blocks
      .map((block) => ({
        block,
        classes: dayClases.filter((c) => getClassTimeBlock(c.hora_inicio) === block),
      }))
      .filter((g) => g.classes.length > 0);
  }, [isAdmin, dayClases]);

  const myReservation = (claseId: string) =>
    localReservas.find(
      (r) =>
        r.clase_id === claseId &&
        r.usuario_id === profileId &&
        isActiveReserva(r.estado)
    );

  const occupiedForSocio = (claseId: string, baseOccupied: number) =>
    occupiedForSocioClass(
      claseId,
      baseOccupied,
      localReservas,
      serverReservas,
      profileId
    );

  const handleBook = async (claseId: string) => {
    const clase = clases.find((c) => c.id === claseId);
    if (!clase || !canBookClass(clase.fecha, clase.hora_inicio, gymTimezone)) return;

    if (
      localReservas.some(
        (r) =>
          r.clase_id === claseId &&
          (r.estado === "confirmada" || isOptimisticReservaId(r.id))
      )
    ) {
      return;
    }

    if (
      hasReachedFutureReservaLimit(
        localReservas,
        profileId,
        clasesById,
        effectiveTimezone,
        APP_CONFIG.MAX_SOCIO_FUTURE_RESERVAS
      )
    ) {
      setBookError(
        t("reservationLimit", { max: APP_CONFIG.MAX_SOCIO_FUTURE_RESERVAS })
      );
      return;
    }

    setLoading(claseId);
    setCancelError(null);
    setBookError(null);

    const tempId = `temp-${Date.now()}`;
    const optimistic: Reserva = {
      id: tempId,
      clase_id: claseId,
      usuario_id: profileId,
      estado: "confirmada",
      fecha_reserva: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    updateReservas((prev) => [...prev, optimistic]);

    const res = await fetch("/api/reservas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clase_id: claseId }),
    });
    const payload = await res.json();

    setLoading(null);

    if (!res.ok || !payload.reserva) {
      updateReservas((prev) => prev.filter((r) => r.id !== tempId));
      const msg = payload.error ?? "";
      if (msg.includes("20 minutos") || msg.includes("20 minutes")) {
        setBookError(
          t("bookTooLate", { minutes: APP_CONFIG.RESERVA_CIERRE_MINUTOS })
        );
      } else if (msg.includes("finalizó") || msg.includes("ended")) {
        setBookError(t("classEnded"));
      } else if (msg.includes("llena") || msg.includes("cupo")) {
        setBookError(t("full"));
      } else if (msg.includes(RESERVA_LIMITE_MAX_CODE)) {
        setBookError(
          t("reservationLimit", { max: APP_CONFIG.MAX_SOCIO_FUTURE_RESERVAS })
        );
      } else {
        setBookError(msg || tc("error"));
      }
      return;
    }

    updateReservas((prev) => {
      const withoutTemp = prev.filter((r) => r.id !== tempId);
      const withoutDup = withoutTemp.filter((r) => r.id !== payload.reserva.id);
      return [...withoutDup, payload.reserva];
    });
    router.refresh();
  };

  const handleCancel = async (
    reservaId: string,
    claseFecha: string,
    horaInicio: string
  ) => {
    if (!canCancelReservation(claseFecha, horaInicio, gymTimezone)) {
      setCancelError(
        t("cancelTooLate", { hours: APP_CONFIG.CANCELACION_HORAS })
      );
      return;
    }

    if (isOptimisticReservaId(reservaId)) {
      updateReservas((prev) => prev.filter((r) => r.id !== reservaId));
      return;
    }

    setCancelError(null);
    setLoading(reservaId);
    const previous = localReservas;
    updateReservas((prev) => prev.filter((r) => r.id !== reservaId));

    const res = await fetch("/api/reservas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reserva_id: reservaId }),
    });
    const payload = await res.json();

    setLoading(null);

    if (!res.ok) {
      updateReservas(previous);
      setCancelError(payload.error ?? tc("error"));
      return;
    }

    router.refresh();
  };

  const dayLabel = (dateStr: string) => {
    if (isAdmin) {
      if (dateStr === today) return t("bookedDayToday");
      if (dateStr === tomorrow) return t("bookedDayTomorrow");
    }
    return formatWeekdayShort(dateStr, locale);
  };
  const isToday = (ds: string) => ds === today;

  const myBookingsOnDay = dayClases.filter((c) => myReservation(c.id)).length;

  const bookedDayLabel = (() => {
    if (selected === today) return t("bookedDayToday");
    if (selected === tomorrow) return t("bookedDayTomorrow");
    return t("bookedDayOn", { date: formatShortDay(selected, locale) });
  })();

  const myScoreForClase = (claseId: string) =>
    classScores.find(
      (s) => s.clase_id === claseId && s.usuario_id === profileId
    );

  return (
    <div className="space-y-4 md:space-y-6">
      {daysWithClasses.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {daysWithClasses.map((ds) => {
            const isSelected = ds === selected;
            const count = displayClases.filter(
              (c) => c.fecha === ds && c.estado === "programada"
            ).length;
            return (
              <button
                key={ds}
                type="button"
                onClick={() => {
                  setSelected(ds);
                  onDayChange?.(ds);
                  setCancelError(null);
                  setBookError(null);
                }}
                className={cn(
                  "relative flex shrink-0 flex-col items-center min-w-[56px] rounded-2xl px-3 py-2.5 text-xs font-semibold transition-all",
                  isSelected
                    ? "brand-gradient text-white glow-primary"
                    : "bg-secondary/60 text-muted-foreground",
                  isToday(ds) && !isSelected && "ring-1 ring-primary/40"
                )}
              >
                {dayLabel(ds)}
                {count > 1 && (
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
      )}

      {!isAdmin && myBookingsOnDay > 0 && (
        <div className="flex items-center gap-2 rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
          {t("bookedSelectedDay", {
            count: myBookingsOnDay,
            dayLabel: bookedDayLabel,
          })}
        </div>
      )}

      {!isAdmin && upcomingReservationCount > 0 && (
        <div
          className={cn(
            "rounded-2xl border px-4 py-3 text-sm leading-relaxed",
            atReservationLimit
              ? "border-orange-500/30 bg-orange-500/10 text-orange-200"
              : "border-white/10 bg-white/[0.03] text-muted-foreground"
          )}
        >
          {t("reservationLimitHint", {
            count: upcomingReservationCount,
            max: APP_CONFIG.MAX_SOCIO_FUTURE_RESERVAS,
          })}
        </div>
      )}

      {bookError && (
        <p className="text-sm text-red-400 text-center rounded-xl bg-red-500/10 px-4 py-3">
          {bookError}
        </p>
      )}

      {cancelError && (
        <p className="text-sm text-orange-400 text-center rounded-xl bg-orange-500/10 px-4 py-3">
          {cancelError}
        </p>
      )}

      {daysWithClasses.length === 0 || dayClases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
          <CalendarX2 className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">
            {isAdmin ? t("adminNoClassesDay") : t("noClasses")}
          </p>
          {daysWithClasses.length > 0 && !isAdmin && (
            <p className="text-xs text-muted-foreground/70 mt-1">
              {t("tryAnotherDay")}
            </p>
          )}
        </div>
      ) : isAdmin ? (
        <div className="space-y-5">
          {adminGroupedClases.map(({ block, classes }) => (
            <section key={block} className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground px-0.5">
                {t(`adminTimeBlock.${block}`)}
              </p>
              {adminViewMode === "list" ? (
                <div className="space-y-1.5">
                  {classes.map((clase) => {
                    const occupied = countReservasForClase(
                      localReservas,
                      clase.id
                    );
                    return (
                      <AdminClassListRow
                        key={clase.id}
                        clase={clase}
                        occupied={occupied}
                        locale={locale}
                        coaches={coaches}
                        existingClases={clases}
                        canEdit={canEditClass}
                        selected={selectedClaseId === clase.id}
                        onSelect={
                          onClassSelect
                            ? () => onClassSelect(clase.id)
                            : undefined
                        }
                        onUpdated={onClassUpdated}
                        onDeleted={() => onClassDeleted?.(clase.id)}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="grid gap-2.5 md:grid-cols-2">
                  {classes.map((clase) => {
                    const occupied = countReservasForClase(
                      localReservas,
                      clase.id
                    );
                    return (
                      <AdminClassCardCompact
                        key={clase.id}
                        clase={clase}
                        occupied={occupied}
                        locale={locale}
                        coaches={coaches}
                        existingClases={clases}
                        canEdit={canEditClass}
                        selected={selectedClaseId === clase.id}
                        onSelect={
                          onClassSelect
                            ? () => onClassSelect(clase.id)
                            : undefined
                        }
                        onUpdated={onClassUpdated}
                        onDeleted={() => onClassDeleted?.(clase.id)}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:gap-4 md:grid-cols-2">
          {dayClases.map((clase) => {
            const occupied = isAdmin
              ? countReservasForClase(localReservas, clase.id)
              : occupiedForSocio(clase.id, clase.cupo_ocupado ?? 0);
            const full = occupied >= clase.cupo_maximo;
            const reservation = myReservation(clase.id);
            const booked = !!reservation;
            const canCancel = booked
              ? canCancelReservation(clase.fecha, clase.hora_inicio, gymTimezone)
              : false;
            const bookingClosed = !canBookClass(
              clase.fecha,
              clase.hora_inicio,
              gymTimezone
            );
            const classEnded = hasClassEnded(
              clase.fecha,
              clase.hora_fin,
              gymTimezone
            );
            const myScore = myScoreForClase(clase.id);
            const canLogScore =
              !isAdmin &&
              booked &&
              classEnded &&
              reservation &&
              reservation.estado !== "no_asistio" &&
              !hasScoreResponse(myScore);

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
                    <CardTitle className="text-lg leading-snug flex-1 min-w-0">
                      {clase.nombre}
                    </CardTitle>
                    <div className="flex items-center gap-1 shrink-0">
                      {isAdmin && canEditClass && (
                        <EditClaseDialog
                          clase={clase}
                          coaches={coaches}
                          existingClases={clases}
                          locale={locale}
                          onUpdated={onClassUpdated}
                        />
                      )}
                      {isAdmin && (
                        <DeleteClaseDialog
                          claseId={clase.id}
                          nombre={clase.nombre}
                          fecha={clase.fecha}
                          locale={locale}
                          enrolledCount={occupied}
                          variant="icon"
                          onDeleted={() => onClassDeleted?.(clase.id)}
                        />
                      )}
                      <Badge
                        variant={full ? "destructive" : booked ? "success" : "secondary"}
                        className="shrink-0"
                      >
                        {full ? t("full") : booked ? t("booked") : t("status.programada")}
                      </Badge>
                    </div>
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
                  <WorkoutBlock entrenamiento={clase.entrenamiento} />
                </CardHeader>
                <CardContent className="space-y-4 pb-5">
                  <CupoProgress occupied={occupied} max={clase.cupo_maximo} />
                  {!isAdmin && (
                    <>
                      {canLogScore && reservation && (
                        <ScoreEntryForm
                          claseId={clase.id}
                          reservaId={reservation.id}
                          usuarioId={profileId}
                        />
                      )}
                      {!isAdmin &&
                        booked &&
                        classEnded &&
                        myScore &&
                        hasScoreResponse(myScore) && (
                          <ScoreResponseSummary score={myScore} />
                        )}
                      {booked && !classEnded ? (
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
                      ) : !booked ? (
                        <div className="space-y-2">
                          <Button
                            className="w-full h-12 rounded-xl text-base font-semibold"
                            disabled={
                              !canBook ||
                              full ||
                              bookingClosed ||
                              atReservationLimit ||
                              loading === clase.id
                            }
                            onClick={() => handleBook(clase.id)}
                          >
                            {loading === clase.id
                              ? tc("loading")
                              : full
                                ? t("full")
                                : atReservationLimit
                                  ? t("reservationLimitShort")
                                  : bookingClosed
                                    ? t("bookClosed")
                                    : t("book")}
                          </Button>
                          {atReservationLimit && !full && !bookingClosed && (
                            <p className="text-xs text-orange-400 text-center leading-relaxed">
                              {t("reservationLimit", {
                                max: APP_CONFIG.MAX_SOCIO_FUTURE_RESERVAS,
                              })}
                            </p>
                          )}
                          {bookingClosed && !full && !classEnded && !atReservationLimit && (
                            <p className="text-xs text-orange-400 text-center leading-relaxed">
                              {t("bookTooLate", {
                                minutes: APP_CONFIG.RESERVA_CIERRE_MINUTOS,
                              })}
                            </p>
                          )}
                        </div>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!isAdmin && athronSummary && !hideRankingWidget && (
        <AthronPointsWidget
          monthPoints={athronSummary.month_points}
          todayPoints={athronSummary.today_points}
          monthRank={athronSummary.month_rank}
          streak={athronSummary.streak}
          category={athronSummary.category}
          locale={locale}
        />
      )}
    </div>
  );
}
