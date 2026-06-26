"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { WeeklyCalendar } from "@/components/clases/weekly-calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn, formatTime } from "@/lib/utils";
import type { Clase, Profile, Reserva } from "@/types/database";

type ReservaRow = Reserva & { profile: Profile | null };

export function AdminClasesClient({
  clases,
  reservas,
  coaches,
  profileId,
  locale,
  isCoach = false,
}: {
  clases: Clase[];
  reservas: ReservaRow[];
  coaches: Profile[];
  profileId: string;
  locale: string;
  isCoach?: boolean;
}) {
  const t = useTranslations("classes");
  const tc = useTranslations("common");
  const router = useRouter();
  const [localReservas, setLocalReservas] = useState(reservas);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingReservaId, setPendingReservaId] = useState<string | null>(null);
  const [selectedClase, setSelectedClase] = useState<string | null>(null);

  useEffect(() => {
    setLocalReservas(reservas);
  }, [reservas]);
  const [form, setForm] = useState<{
    nombre: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    cupo_maximo: number;
    coach_id: string;
  }>({
    nombre: "",
    fecha: new Date().toISOString().split("T")[0],
    hora_inicio: "07:00",
    hora_fin: "08:00",
    cupo_maximo: APP_CONFIG.CUPO_DEFAULT,
    coach_id: coaches[0]?.id ?? "",
  });

  const createClase = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.from("clases").insert({
      ...form,
      coach_id: form.coach_id || null,
      estado: "programada",
    });
    setOpen(false);
    router.refresh();
    setLoading(false);
  };

  const markAttendance = async (
    reservaId: string,
    estado: "asistio" | "no_asistio"
  ) => {
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

  const selectedClaseData = clases.find((c) => c.id === selectedClase);
  const claseReservas = localReservas.filter(
    (r) =>
      r.clase_id === selectedClase &&
      ["confirmada", "asistio", "no_asistio"].includes(r.estado)
  );

  const sortedClases = [...clases].sort((a, b) =>
    `${a.fecha}${a.hora_inicio}`.localeCompare(`${b.fecha}${b.hora_inicio}`)
  );

  const AttendanceList = () => (
    <div className="space-y-2">
      {claseReservas.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noEnrolled")}</p>
      ) : (
        claseReservas.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-secondary/30 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">
                {r.profile?.nombre_completo ?? "—"}
              </p>
              {r.estado !== "confirmada" && (
                <Badge
                  variant={r.estado === "asistio" ? "success" : "destructive"}
                  className="mt-1"
                >
                  {r.estado === "asistio" ? t("attended") : t("noShow")}
                </Badge>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                size="icon"
                variant={r.estado === "asistio" ? "default" : "outline"}
                className={cn(
                  "h-9 w-9",
                  r.estado === "asistio" && "bg-green-600 hover:bg-green-600"
                )}
                disabled={pendingReservaId === r.id}
                onClick={() => markAttendance(r.id, "asistio")}
                title={t("attended")}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant={r.estado === "no_asistio" ? "destructive" : "outline"}
                className="h-9 w-9"
                disabled={pendingReservaId === r.id}
                onClick={() => markAttendance(r.id, "no_asistio")}
                title={t("noShow")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  if (isCoach) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black brand-text">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">{t("coachClassesDesc")}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("myClasses")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sortedClases.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noClasses")}</p>
              ) : (
                sortedClases.map((c) => {
                  const count = localReservas.filter(
                    (r) =>
                      r.clase_id === c.id &&
                      ["confirmada", "asistio", "no_asistio"].includes(r.estado)
                  ).length;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedClase(c.id)}
                      className={cn(
                        "w-full rounded-lg border border-white/10 px-4 py-3 text-left transition-colors hover:bg-white/5",
                        selectedClase === c.id &&
                          "border-primary bg-primary/10 ring-1 ring-primary"
                      )}
                    >
                      <p className="font-semibold">{c.nombre}</p>
                      <p className="text-sm text-muted-foreground">
                        {c.fecha} · {formatTime(c.hora_inicio)} –{" "}
                        {formatTime(c.hora_fin)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("enrolled")}: {count}
                      </p>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("attendance")}</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedClaseData ? (
                <>
                  <p className="text-sm font-medium mb-3">
                    {selectedClaseData.nombre} — {selectedClaseData.fecha}
                  </p>
                  <AttendanceList />
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
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black brand-text">{t("title")}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>{t("create")}</Button>
          </DialogTrigger>
          <DialogContent>
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
              <Button
                onClick={createClase}
                disabled={loading}
                className="w-full"
              >
                {loading ? tc("loading") : t("create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <WeeklyCalendar
        clases={clases}
        reservas={localReservas}
        profileId={profileId}
        canBook={false}
        locale={locale}
        isAdmin
      />

      <Card>
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
              {clases.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre} — {c.fecha}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedClase && <AttendanceList />}
        </CardContent>
      </Card>
    </div>
  );
}
