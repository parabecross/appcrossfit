"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Check, Users, X } from "lucide-react";
import { WeeklyCalendar } from "@/components/clases/weekly-calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_CONFIG } from "@/lib/config/app-config";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/routing";
import {
  getClassDates,
  dateStringToLocalDate,
  toDateString,
  findOverlappingClasses,
  hasClassEnded,
} from "@/lib/clases/helpers";
import {
  cn,
  formatShortDay,
  formatTime,
  formatWeekdayShort,
} from "@/lib/utils";
import type { Clase, Profile, Reserva } from "@/types/database";
import { DeleteClaseDialog } from "@/components/admin/delete-clase-dialog";
import { EditClaseDialog } from "@/components/admin/edit-clase-dialog";
import { ScheduleOverlapDialog } from "@/components/admin/schedule-overlap-dialog";
import { WorkoutBlock } from "@/components/clases/workout-block";
import { getSampleWorkout } from "@/lib/clases/sample-workouts";
import { useReservasRealtime } from "@/lib/hooks/use-reservas-realtime";

type ReservaRow = Reserva & { profile: Profile | null };

export function AdminClasesClient({
  clases,
  reservas,
  coaches,
  profileId,
  locale,
  isCoach = false,
  gymTimezone,
}: {
  clases: Clase[];
  reservas: ReservaRow[];
  coaches: Profile[];
  profileId: string;
  locale: string;
  isCoach?: boolean;
  gymTimezone?: string;
}) {
  const t = useTranslations("classes");
  const tc = useTranslations("common");
  const router = useRouter();
  const today = toDateString(new Date());

  const [localReservas, setLocalReservas] = useState(reservas);
  const [localClases, setLocalClases] = useState(clases);
  const [open, setOpen] = useState(false);
  const [overlapOpen, setOverlapOpen] = useState(false);
  const [overlapConflicts, setOverlapConflicts] = useState<
    ReturnType<typeof findOverlappingClasses>
  >([]);
  const [loading, setLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const [pendingReservaId, setPendingReservaId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(today);
  const [calendarDay, setCalendarDay] = useState(today);
  const [selectedClase, setSelectedClase] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"list" | "attendance">("list");

  useEffect(() => {
    setLocalReservas(reservas);
  }, [reservas]);

  useEffect(() => {
    setLocalClases(clases);
  }, [clases]);

  const claseIds = useMemo(
    () => localClases.map((c) => c.id),
    [localClases]
  );

  const handleReservasRealtime = useCallback((updated: ReservaRow[]) => {
    setLocalReservas(updated);
  }, []);

  useReservasRealtime(claseIds, handleReservasRealtime);

  const [form, setForm] = useState<{
    nombre: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    cupo_maximo: number;
    coach_id: string;
    entrenamiento: string;
  }>({
    nombre: "",
    fecha: today,
    hora_inicio: "07:00",
    hora_fin: "08:00",
    cupo_maximo: APP_CONFIG.CUPO_DEFAULT,
    coach_id: coaches[0]?.id ?? "",
    entrenamiento: "",
  });

  const sortedClases = useMemo(
    () =>
      [...localClases].sort((a, b) =>
        `${a.fecha}${a.hora_inicio}`.localeCompare(`${b.fecha}${b.hora_inicio}`)
      ),
    [localClases]
  );

  const daysWithClasses = useMemo(
    () => getClassDates(sortedClases),
    [sortedClases]
  );

  const dayClases = useMemo(
    () => sortedClases.filter((c) => c.fecha === selectedDay),
    [sortedClases, selectedDay]
  );

  useEffect(() => {
    if (daysWithClasses.length === 0) return;
    if (!daysWithClasses.includes(selectedDay)) {
      setSelectedDay(daysWithClasses[0]);
    }
  }, [daysWithClasses, selectedDay]);

  useEffect(() => {
    if (!isCoach || !selectedClase) return;
    if (
      dayClases.length === 0 ||
      !dayClases.some((c) => c.id === selectedClase)
    ) {
      setSelectedClase(null);
      setMobilePanel("list");
    }
  }, [isCoach, selectedDay, dayClases, selectedClase]);

  useEffect(() => {
    if (isCoach || daysWithClasses.length === 0) return;
    if (!daysWithClasses.includes(calendarDay)) {
      setCalendarDay(daysWithClasses[0]);
    }
  }, [isCoach, daysWithClasses, calendarDay]);

  const enrollmentCount = (claseId: string) =>
    localReservas.filter(
      (r) =>
        r.clase_id === claseId &&
        ["confirmada", "asistio", "no_asistio"].includes(r.estado)
    ).length;

  const selectedClaseData = localClases.find((c) => c.id === selectedClase);
  const canMarkAttendance = selectedClaseData
    ? hasClassEnded(
        selectedClaseData.fecha,
        selectedClaseData.hora_fin,
        gymTimezone
      )
    : false;

  const attendanceDayClasses = useMemo(
    () =>
      [...localClases]
        .filter((c) => c.fecha === calendarDay && c.estado === "programada")
        .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)),
    [localClases, calendarDay]
  );

  const handleClassSelect = useCallback(
    (claseId: string) => {
      const clase = localClases.find((c) => c.id === claseId);
      if (clase) setCalendarDay(clase.fecha);
      setSelectedClase(claseId);
    },
    [localClases]
  );

  const handleCalendarDayChange = useCallback(
    (date: string) => {
      setCalendarDay(date);
      setSelectedClase((current) => {
        if (!current) return null;
        const match = localClases.find(
          (c) => c.id === current && c.fecha === date
        );
        return match ? current : null;
      });
    },
    [localClases]
  );

  useEffect(() => {
    if (selectedClaseData && selectedClaseData.fecha !== calendarDay) {
      setCalendarDay(selectedClaseData.fecha);
    }
  }, [selectedClaseData, calendarDay]);

  const claseReservas = localReservas.filter(
    (r) =>
      r.clase_id === selectedClase &&
      ["confirmada", "asistio", "no_asistio"].includes(r.estado)
  );

  const markedCount = claseReservas.filter((r) =>
    ["asistio", "no_asistio"].includes(r.estado)
  ).length;

  const validateCreateForm = (): string | null => {
    if (!form.nombre.trim()) return t("classNameRequired");
    if (form.hora_fin <= form.hora_inicio) return t("invalidTimeRange");
    return null;
  };

  const executeCreateClase = async () => {
    setLoading(true);
    setCreateError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("clases")
      .insert({
        nombre: form.nombre.trim(),
        fecha: form.fecha,
        hora_inicio: form.hora_inicio,
        hora_fin: form.hora_fin,
        cupo_maximo: form.cupo_maximo,
        coach_id: form.coach_id || null,
        entrenamiento: form.entrenamiento.trim() || getSampleWorkout(form.nombre.trim()),
        estado: "programada",
      })
      .select("*")
      .single();

    setLoading(false);

    if (error || !data) {
      setCreateError(error?.message ?? tc("error"));
      return;
    }

    const coach = coaches.find((c) => c.id === form.coach_id);
    const newClase: Clase = {
      ...data,
      coach_nombre: coach?.nombre_completo ?? null,
      coach_foto_url: coach?.foto_url ?? null,
      coach_bio: coach?.bio ?? null,
      cupo_ocupado: 0,
    };

    setLocalClases((prev) =>
      [...prev, newClase].sort((a, b) =>
        `${a.fecha}${a.hora_inicio}`.localeCompare(`${b.fecha}${b.hora_inicio}`)
      )
    );
    setFocusDate(form.fecha);
    setOverlapOpen(false);
    setOpen(false);
    setForm({
      nombre: "",
      fecha: today,
      hora_inicio: "07:00",
      hora_fin: "08:00",
      cupo_maximo: APP_CONFIG.CUPO_DEFAULT,
      coach_id: coaches[0]?.id ?? "",
      entrenamiento: "",
    });
    router.refresh();
  };

  const handleCreateSubmit = () => {
    const validationError = validateCreateForm();
    if (validationError) {
      setCreateError(validationError);
      return;
    }

    const conflicts = findOverlappingClasses(sortedClases, {
      fecha: form.fecha,
      hora_inicio: form.hora_inicio,
      hora_fin: form.hora_fin,
      estado: "programada",
    });

    if (conflicts.length > 0) {
      setOverlapConflicts(conflicts);
      setOverlapOpen(true);
      return;
    }

    void executeCreateClase();
  };

  const markAttendance = async (
    reservaId: string,
    estado: "asistio" | "no_asistio"
  ) => {
    if (!canMarkAttendance) return;

    const previous = localReservas.find((r) => r.id === reservaId);
    if (!previous) return;

    setLocalReservas((current) =>
      current.map((r) => (r.id === reservaId ? { ...r, estado } : r))
    );
    setPendingReservaId(reservaId);

    const supabase = createClient();
    const { error } = await supabase
      .from("reservas")
      .update({ estado })
      .eq("id", reservaId);

    setPendingReservaId(null);

    if (error) {
      setLocalReservas((current) =>
        current.map((r) => (r.id === reservaId ? previous : r))
      );
      return;
    }

    router.refresh();
  };

  const openAttendance = (claseId: string) => {
    setSelectedClase(claseId);
    setMobilePanel("attendance");
  };

  const handleClassDeleted = (claseId: string) => {
    setLocalClases((prev) => prev.filter((c) => c.id !== claseId));
    if (selectedClase === claseId) setSelectedClase(null);
  };

  const handleClassUpdated = (updated: Clase) => {
    setLocalClases((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
    if (updated.fecha !== selectedDay && !isCoach) {
      setFocusDate(updated.fecha);
    }
  };

  const DayPicker = () => {
    if (daysWithClasses.length === 0) return null;

    return (
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {daysWithClasses.map((ds) => {
          const isSelected = ds === selectedDay;
          const count = sortedClases.filter((c) => c.fecha === ds).length;
          return (
            <button
              key={ds}
              type="button"
              onClick={() => setSelectedDay(ds)}
              className={cn(
                "flex shrink-0 flex-col items-center min-w-[56px] rounded-2xl px-3 py-2.5 text-xs font-semibold transition-all",
                isSelected
                  ? "brand-gradient text-white glow-primary"
                  : "bg-secondary/60 text-muted-foreground"
              )}
            >
              <span>{formatWeekdayShort(dateStringToLocalDate(ds), locale)}</span>
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
    );
  };

  const AttendanceList = ({ compact = false }: { compact?: boolean }) => (
    <div className="space-y-2">
      {!canMarkAttendance && selectedClaseData && (
        <p className="text-xs text-muted-foreground rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          {t("attendanceAfterClass")}
        </p>
      )}
      {claseReservas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">{t("noEnrolled")}</p>
        </div>
      ) : (
        claseReservas.map((r) => (
          <div
            key={r.id}
            className={cn(
              "flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-secondary/20",
              compact ? "px-3 py-3" : "px-4 py-4"
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate text-base">
                {r.profile?.nombre_completo ?? "—"}
              </p>
              {canMarkAttendance && r.estado !== "confirmada" && (
                <Badge
                  variant={r.estado === "asistio" ? "success" : "destructive"}
                  className="mt-1.5"
                >
                  {r.estado === "asistio" ? t("attended") : t("noShow")}
                </Badge>
              )}
              {(!canMarkAttendance || r.estado === "confirmada") && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("enrolled")}
                </p>
              )}
            </div>
            {canMarkAttendance ? (
              <div className="flex gap-2 shrink-0">
                <Button
                  size={compact ? "icon" : "default"}
                  variant={r.estado === "asistio" ? "default" : "outline"}
                  className={cn(
                    compact ? "h-11 w-11" : "h-11 px-4",
                    r.estado === "asistio" && "bg-green-600 hover:bg-green-600"
                  )}
                  disabled={pendingReservaId === r.id}
                  onClick={() => markAttendance(r.id, "asistio")}
                >
                  <Check className="h-5 w-5" />
                  {!compact && (
                    <span className="ml-1 hidden sm:inline">{t("attended")}</span>
                  )}
                </Button>
                <Button
                  size={compact ? "icon" : "default"}
                  variant={r.estado === "no_asistio" ? "destructive" : "outline"}
                  className={compact ? "h-11 w-11" : "h-11 px-4"}
                  disabled={pendingReservaId === r.id}
                  onClick={() => markAttendance(r.id, "no_asistio")}
                >
                  <X className="h-5 w-5" />
                  {!compact && (
                    <span className="ml-1 hidden sm:inline">{t("noShow")}</span>
                  )}
                </Button>
              </div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );

  const ClassCard = ({
    c,
    onSelect,
    selected,
  }: {
    c: Clase;
    onSelect: () => void;
    selected: boolean;
  }) => {
    const count = enrollmentCount(c.id);
    const classEnded = hasClassEnded(c.fecha, c.hora_fin, gymTimezone);
    const attended = classEnded
      ? localReservas.filter(
          (r) => r.clase_id === c.id && r.estado === "asistio"
        ).length
      : 0;

    return (
      <div
        className={cn(
          "w-full rounded-2xl border px-4 py-4 text-left transition-all",
          selected
            ? "border-primary/60 bg-primary/10 ring-1 ring-primary/40"
            : "border-white/10 bg-card/50 hover:border-white/20"
        )}
      >
        <button type="button" onClick={onSelect} className="w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-base">{c.nombre}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {formatTime(c.hora_inicio)} – {formatTime(c.hora_fin)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge variant="secondary" className="font-semibold">
                {count} {t("enrolled").toLowerCase()}
              </Badge>
              {attended > 0 && (
                <span className="text-[10px] text-green-400">
                  {attended} ✓
                </span>
              )}
            </div>
          </div>
        </button>
        <WorkoutBlock entrenamiento={c.entrenamiento} compact className="mt-3" />
        {isCoach && (
          <div className="mt-2 flex justify-end">
            <EditClaseDialog
              clase={c}
              coaches={coaches}
              existingClases={localClases}
              locale={locale}
              isCoach
              variant="button"
              onUpdated={handleClassUpdated}
            />
          </div>
        )}
      </div>
    );
  };

  if (isCoach) {
    return (
      <div className="space-y-4 md:space-y-6">
        {/* Mobile: full-screen attendance panel */}
        <div className={cn("md:hidden", mobilePanel === "list" && "hidden")}>
          {selectedClaseData && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setMobilePanel("list")}
                className="flex items-center gap-2 text-sm font-medium text-primary -ml-1 py-1"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("myClasses")}
              </button>

              <div className="rounded-2xl brand-gradient p-4 text-white">
                <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                  {t("attendance")}
                </p>
                <p className="text-xl font-black mt-1">{selectedClaseData.nombre}</p>
                <p className="text-sm opacity-90 mt-0.5">
                  {formatShortDay(selectedClaseData.fecha, locale)} ·{" "}
                  {formatTime(selectedClaseData.hora_inicio)} –{" "}
                  {formatTime(selectedClaseData.hora_fin)}
                </p>
                {claseReservas.length > 0 && (
                  <p className="text-xs mt-2 opacity-80">
                    {markedCount}/{claseReservas.length} {t("attendance").toLowerCase()}
                  </p>
                )}
              </div>

              <WorkoutBlock entrenamiento={selectedClaseData.entrenamiento} />
              <div className="flex justify-end">
                <EditClaseDialog
                  clase={selectedClaseData}
                  coaches={coaches}
                  existingClases={localClases}
                  locale={locale}
                  isCoach
                  variant="button"
                  onUpdated={handleClassUpdated}
                />
              </div>

              <AttendanceList />
            </div>
          )}
        </div>

        {/* Mobile: class list */}
        <div className={cn("md:hidden space-y-4", mobilePanel === "attendance" && "hidden")}>
          <p className="text-sm text-muted-foreground">{t("coachClassesDesc")}</p>
          <DayPicker />

          {dayClases.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
              <p className="text-muted-foreground">{t("noClasses")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dayClases.map((c) => (
                <ClassCard
                  key={c.id}
                  c={c}
                  selected={selectedClase === c.id}
                  onSelect={() => openAttendance(c.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Desktop: two columns */}
        <div className="hidden md:block space-y-6">
          <div>
            <h1 className="text-3xl font-black brand-text">{t("title")}</h1>
            <p className="text-muted-foreground mt-1">{t("coachClassesDesc")}</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-white/5">
              <CardHeader className="pb-3">
                <CardTitle>{t("myClasses")}</CardTitle>
                <DayPicker />
              </CardHeader>
              <CardContent className="space-y-2">
                {dayClases.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noClasses")}</p>
                ) : (
                  dayClases.map((c) => (
                    <ClassCard
                      key={c.id}
                      c={c}
                      selected={selectedClase === c.id}
                      onSelect={() => setSelectedClase(c.id)}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-white/5">
              <CardHeader>
                <CardTitle>{t("attendance")}</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedClaseData ? (
                  <>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <p className="text-sm font-medium">
                        {selectedClaseData.nombre} —{" "}
                        {formatShortDay(selectedClaseData.fecha, locale)}
                      </p>
                      <EditClaseDialog
                        clase={selectedClaseData}
                        coaches={coaches}
                        existingClases={localClases}
                        locale={locale}
                        isCoach
                        variant="icon"
                        onUpdated={handleClassUpdated}
                      />
                    </div>
                    <WorkoutBlock
                      entrenamiento={selectedClaseData.entrenamiento}
                      className="mb-4"
                    />
                    <AttendanceList compact />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("selectClassForAttendance")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <h1 className="text-2xl md:text-3xl font-black brand-text">{t("title")}</h1>
        <Dialog open={open} onOpenChange={(v) => {
          setOpen(v);
          if (!v) setCreateError(null);
        }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">{t("create")}</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("create")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("className")}</Label>
                <Input
                  value={form.nombre}
                  onChange={(e) =>
                    setForm({ ...form, nombre: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{t("classDate")}</Label>
                <Input
                  type="date"
                  value={form.fecha}
                  onChange={(e) =>
                    setForm({ ...form, fecha: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{t("startTime")}</Label>
                  <Input
                    type="time"
                    value={form.hora_inicio}
                    onChange={(e) =>
                      setForm({ ...form, hora_inicio: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>{t("endTime")}</Label>
                  <Input
                    type="time"
                    value={form.hora_fin}
                    onChange={(e) =>
                      setForm({ ...form, hora_fin: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>{t("maxSpots")}</Label>
                <Input
                  type="number"
                  value={form.cupo_maximo}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      cupo_maximo: parseInt(e.target.value, 10),
                    })
                  }
                />
              </div>
              <div>
                <Label>{t("selectCoach")}</Label>
                <Select
                  value={form.coach_id}
                  onValueChange={(v) => setForm({ ...form, coach_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {coaches.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("workout")}</Label>
                <Textarea
                  value={form.entrenamiento}
                  placeholder={t("workoutPlaceholder")}
                  onChange={(e) =>
                    setForm({ ...form, entrenamiento: e.target.value })
                  }
                  rows={5}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("workoutCreateHint")}
                </p>
              </div>
              <Button
                onClick={handleCreateSubmit}
                disabled={loading}
                className="w-full"
              >
                {loading ? tc("loading") : t("create")}
              </Button>
              {createError && (
                <p className="text-sm text-red-400">{createError}</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
        <ScheduleOverlapDialog
          open={overlapOpen}
          onOpenChange={setOverlapOpen}
          conflicts={overlapConflicts}
          locale={locale}
          onConfirm={() => void executeCreateClase()}
          loading={loading}
        />
      </div>

      <WeeklyCalendar
        clases={localClases}
        reservas={localReservas}
        profileId={profileId}
        canBook={false}
        locale={locale}
        isAdmin
        canEditClass
        coaches={coaches}
        onClassSelect={handleClassSelect}
        onDayChange={handleCalendarDayChange}
        selectedClaseId={selectedClase}
        onClassDeleted={handleClassDeleted}
        onClassUpdated={handleClassUpdated}
        focusDate={focusDate}
        gymTimezone={gymTimezone}
      />

      {/* Mobile: slide-up attendance when class selected */}
      <div
        className={cn(
          "md:hidden fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-card shadow-2xl transition-transform duration-300 safe-bottom pb-20",
          selectedClase ? "translate-y-0" : "translate-y-full pointer-events-none"
        )}
      >
        {selectedClaseData && (
          <div className="p-4 space-y-4">
            <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-primary uppercase tracking-wide">
                  {t("attendance")}
                </p>
                <p className="font-bold text-lg">{selectedClaseData.nombre}</p>
                <p className="text-sm text-muted-foreground">
                  {formatShortDay(selectedClaseData.fecha, locale)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <EditClaseDialog
                  clase={selectedClaseData}
                  coaches={coaches}
                  existingClases={localClases}
                  locale={locale}
                  onUpdated={handleClassUpdated}
                />
                <DeleteClaseDialog
                  claseId={selectedClaseData.id}
                  nombre={selectedClaseData.nombre}
                  fecha={selectedClaseData.fecha}
                  locale={locale}
                  enrolledCount={claseReservas.length}
                  variant="icon"
                  onDeleted={() => handleClassDeleted(selectedClaseData.id)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedClase(null)}
                >
                  {tc("close")}
                </Button>
              </div>
            </div>
            <WorkoutBlock entrenamiento={selectedClaseData.entrenamiento} />
            <AttendanceList />
          </div>
        )}
      </div>

      {/* Desktop: attendance card */}
      <Card className="hidden md:block border-white/5">
        <CardHeader>
          <CardTitle>{t("attendance")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={selectedClase ?? ""}
            onValueChange={setSelectedClase}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("selectClassForAttendance")} />
            </SelectTrigger>
            <SelectContent>
              {attendanceDayClasses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre} — {formatTime(c.hora_inicio)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedClase && selectedClaseData && (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">
                  {selectedClaseData.nombre} —{" "}
                  {formatShortDay(selectedClaseData.fecha, locale)}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <EditClaseDialog
                    clase={selectedClaseData}
                    coaches={coaches}
                    existingClases={localClases}
                    locale={locale}
                    variant="button"
                    onUpdated={handleClassUpdated}
                  />
                  <DeleteClaseDialog
                    claseId={selectedClaseData.id}
                    nombre={selectedClaseData.nombre}
                    fecha={selectedClaseData.fecha}
                    locale={locale}
                    enrolledCount={claseReservas.length}
                    variant="button"
                    onDeleted={() => handleClassDeleted(selectedClaseData.id)}
                  />
                </div>
              </div>
              <WorkoutBlock entrenamiento={selectedClaseData.entrenamiento} />
              <AttendanceList compact />
            </>
          )}
        </CardContent>
      </Card>

      {/* Mobile hint */}
      {!selectedClase && (
        <p className="md:hidden text-center text-sm text-muted-foreground pb-2">
          {t("tapClassForAttendance")}
        </p>
      )}
    </div>
  );
}
