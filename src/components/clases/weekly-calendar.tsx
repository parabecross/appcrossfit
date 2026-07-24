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
  filterClassesForSocioMisReservas,
  hasClassEnded,
} from "@/lib/clases/helpers";
import { canAthleteManageClassScore } from "@/lib/clases/athlete-score";
import {
  getClassTimeBlock,
  getSocioDayPeriod,
  type ClassTimeBlock,
  type SocioDayPeriod,
} from "@/lib/clases/workout-summary";
import { SocioClassPeriodSection } from "@/components/clases/socio-class-period-section";
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
import {
  countReservasForClase,
  countUpcomingActiveReservasForUser,
  hasReachedFutureReservaLimit,
  isActiveReserva,
  isOptimisticReservaId,
  occupiedForSocioClass,
  RESERVA_LIMITE_MAX_CODE,
} from "@/lib/reservas/helpers";
import {
  applyLocalCancel,
  isCancelInFlight,
  requestCancelReserva,
  shouldApplyCancelOutcome,
  subscribeCancelInFlight,
} from "@/lib/reservas/cancel-flow";
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
  /** Lighter mobile layout for socio booking home */
  socioCompact?: boolean;
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
  socioCompact = false,
}: WeeklyCalendarProps) {
  const t = useTranslations("classes");
  const tc = useTranslations("common");
  const router = useRouter();
  const today = gymTimezone
    ? todayInTimezone(gymTimezone)
    : toDateString(new Date());
  const tomorrow = addDaysToDateString(today, 1);
  const controlled = !!onReservationsChange;
  const [uncontrolledReservas, setUncontrolledReservas] = useState(reservas);
  const [loading, setLoading] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  const [openPeriods, setOpenPeriods] = useState<Set<SocioDayPeriod>>(new Set());
  const [scoreEditClaseId, setScoreEditClaseId] = useState<string | null>(null);
  const [, setCancelLockVersion] = useState(0);

  const localReservas = controlled ? reservas : uncontrolledReservas;
  const updateReservas = controlled ? onReservationsChange! : setUncontrolledReservas;

  useEffect(() => {
    return subscribeCancelInFlight(() => {
      setCancelLockVersion((v) => v + 1);
    });
  }, []);
  const effectiveTimezone = gymTimezone ?? APP_CONFIG.GYM_TIMEZONE;

  const displayClases = useMemo(
    () =>
      isAdmin
        ? clases
        : filterClassesForSocioMisReservas(
            clases,
            localReservas,
            profileId,
            effectiveTimezone
          ),
    [clases, isAdmin, localReservas, profileId, effectiveTimezone]
  );
  const daysWithClasses = useMemo(
    () => getClassDates(displayClases),
    [displayClases]
  );
  const [selected, setSelected] = useState(today);

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

  const socioGroupedClases = useMemo(() => {
    if (isAdmin) return [];
    const periods: SocioDayPeriod[] = ["morning", "afternoon"];
    return periods
      .map((period) => ({
        period,
        classes: dayClases.filter(
          (c) => getSocioDayPeriod(c.hora_inicio) === period
        ),
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

  useEffect(() => {
    if (isAdmin) return;
    setOpenPeriods(new Set());
  }, [selected, isAdmin]);

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

    if (isCancelInFlight(reservaId)) return;

    setCancelError(null);
    setLoading(reservaId);

    try {
      const outcome = await requestCancelReserva({ reservaId });

      // started: false → otro componente ya disparó el PATCH
      if (!outcome.started) return;

      if (!outcome.ok) {
        if (!outcome.discarded) {
          setCancelError(outcome.message ?? tc("error"));
        }
        return;
      }

      if (!shouldApplyCancelOutcome(reservaId, outcome.requestId)) return;

      // Solo tras confirmación del servidor — sin optimistic cupo
      updateReservas((prev) => applyLocalCancel(prev, reservaId));
      router.refresh();
    } finally {
      setLoading(null);
    }
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

  const togglePeriod = (period: SocioDayPeriod) => {
    setOpenPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(period)) next.delete(period);
      else next.add(period);
      return next;
    });
  };

  const periodSectionSubtitle = (
    classCount: number,
    bookedCount: number
  ) => {
    const classesLabel = t("socioTimeBlockClasses", { count: classCount });
    if (bookedCount <= 0) return classesLabel;
    return `${classesLabel} · ${t("socioTimeBlockBooked", { count: bookedCount })}`;
  };

  const renderSocioClassCard = (clase: Clase) => {
    const occupied = occupiedForSocio(clase.id, clase.cupo_ocupado ?? 0);
    const full = occupied >= clase.cupo_maximo;
    const anyReservation = localReservas.find(
      (r) => r.clase_id === clase.id && r.usuario_id === profileId
    );
    const reservation = localReservas.find(
      (r) =>
        r.clase_id === clase.id &&
        r.usuario_id === profileId &&
        isActiveReserva(r.estado)
    );
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
    const canManageScore =
      !!gymTimezone &&
      canAthleteManageClassScore({
        classDate: clase.fecha,
        classEndTime: clase.hora_fin,
        reservationStatus: (reservation ?? anyReservation)?.estado,
        timezone: gymTimezone,
      });
    const scoreOpen =
      canManageScore &&
      (scoreEditClaseId === clase.id || !hasScoreResponse(myScore));
    const statusForBadge = (reservation ?? anyReservation)?.estado;

    return (
      <Card
        key={clase.id}
        className={cn(
          "border-white/5 transition-all rounded-2xl overflow-hidden",
          booked &&
            "ring-2 ring-green-500/40 border-green-500/30 bg-green-500/[0.03]"
        )}
      >
        {booked && !classEnded && (
          <div className="bg-green-600/90 px-4 py-1.5 text-center text-xs font-semibold text-white">
            {t("booked")}
          </div>
        )}
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg leading-snug flex-1 min-w-0">
              {clase.nombre}
            </CardTitle>
            <Badge
              variant={
                statusForBadge === "no_asistio"
                  ? "destructive"
                  : statusForBadge === "asistio"
                    ? "success"
                    : full
                      ? "destructive"
                      : booked
                        ? "success"
                        : "secondary"
              }
              className="shrink-0"
            >
              {statusForBadge === "asistio"
                ? t("attended")
                : statusForBadge === "no_asistio"
                  ? t("noShow")
                  : statusForBadge === "cancelada"
                    ? t("status.cancelada")
                    : full
                      ? t("full")
                      : booked
                        ? t("booked")
                        : t("status.programada")}
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
          <WorkoutBlock entrenamiento={clase.entrenamiento} />
        </CardHeader>
        <CardContent className="space-y-4 pb-5">
          {!classEnded && (
            <CupoProgress occupied={occupied} max={clase.cupo_maximo} />
          )}
          {canManageScore &&
            hasScoreResponse(myScore) &&
            scoreEditClaseId !== clase.id && (
              <div className="space-y-2">
                <ScoreResponseSummary score={myScore!} />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-h-11 rounded-xl"
                  onClick={() => setScoreEditClaseId(clase.id)}
                >
                  {t("editResult")}
                </Button>
              </div>
            )}
          {scoreOpen && (reservation ?? anyReservation) && (
            <ScoreEntryForm
              claseId={clase.id}
              reservaId={(reservation ?? anyReservation)!.id}
              usuarioId={profileId}
              existing={myScore ?? null}
              entrenamiento={clase.entrenamiento}
              onSaved={() => setScoreEditClaseId(null)}
              onCancel={
                hasScoreResponse(myScore)
                  ? () => setScoreEditClaseId(null)
                  : undefined
              }
            />
          )}
          {!canManageScore &&
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
                  !canCancel ||
                  loading === reservation?.id ||
                  (!!reservation && isCancelInFlight(reservation.id))
                }
                onClick={() =>
                  handleCancel(
                    reservation!.id,
                    clase.fecha,
                    clase.hora_inicio
                  )
                }
              >
                {loading === reservation?.id ||
                (reservation && isCancelInFlight(reservation.id))
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
          ) : !booked && !classEnded ? (
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
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={cn("space-y-3", !socioCompact && "md:space-y-6")}>
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
                  "relative flex shrink-0 flex-col items-center rounded-xl px-2.5 text-xs font-semibold transition-all",
                  socioCompact ? "min-w-[50px] py-2" : "min-w-[56px] py-2.5 rounded-2xl",
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
        socioCompact ? (
          <p className="text-xs text-green-400/90 px-0.5">
            {t("bookedSelectedDay", {
              count: myBookingsOnDay,
              dayLabel: bookedDayLabel,
            })}
          </p>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
            {t("bookedSelectedDay", {
              count: myBookingsOnDay,
              dayLabel: bookedDayLabel,
            })}
          </div>
        )
      )}

      {!isAdmin && upcomingReservationCount > 0 && (
        socioCompact ? (
          <p
            className={cn(
              "text-xs leading-relaxed px-0.5",
              atReservationLimit ? "text-orange-400" : "text-muted-foreground"
            )}
          >
            {t("reservationLimitHint", {
              count: upcomingReservationCount,
              max: APP_CONFIG.MAX_SOCIO_FUTURE_RESERVAS,
            })}
          </p>
        ) : (
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
        )
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
        <div className={cn("space-y-2 pb-1", socioCompact && "pb-2")}>
          {socioGroupedClases.map(({ period, classes }) => {
            const bookedInSection = classes.filter((c) => myReservation(c.id)).length;
            return (
              <SocioClassPeriodSection
                key={period}
                title={t(`socioTimeBlock.${period}`)}
                subtitle={periodSectionSubtitle(classes.length, bookedInSection)}
                open={openPeriods.has(period)}
                onToggle={() => togglePeriod(period)}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  {classes.map((clase) => renderSocioClassCard(clase))}
                </div>
              </SocioClassPeriodSection>
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
