"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { WeeklyCalendar } from "@/components/clases/weekly-calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { Clase, Profile, Reserva } from "@/types/database";

export function AdminClasesClient({
  clases,
  reservas,
  coaches,
  profileId,
  locale,
}: {
  clases: Clase[];
  reservas: (Reserva & { profile: Profile | null })[];
  coaches: Profile[];
  profileId: string;
  locale: string;
}) {
  const t = useTranslations("classes");
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedClase, setSelectedClase] = useState<string | null>(null);
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
    await supabase.from("reservas").update({ estado }).eq("id", reservaId);
    router.refresh();
  };

  const claseReservas = reservas.filter(
    (r) => r.clase_id === selectedClase && r.estado === "confirmada"
  );

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
                <Label>Nombre</Label>
                <Input
                  value={form.nombre}
                  onChange={(e) =>
                    setForm({ ...form, nombre: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Fecha</Label>
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
                  <Label>Inicio</Label>
                  <Input
                    type="time"
                    value={form.hora_inicio}
                    onChange={(e) =>
                      setForm({ ...form, hora_inicio: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Fin</Label>
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
                <Label>Cupo</Label>
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
                {t("create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <WeeklyCalendar
        clases={clases}
        reservas={reservas}
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
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {clases.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre} — {c.fecha}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedClase && (
            <div className="space-y-2">
              {claseReservas.length === 0 ? (
                <p className="text-muted-foreground text-sm">—</p>
              ) : (
                claseReservas.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2"
                  >
                    <span>{r.profile?.nombre_completo}</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markAttendance(r.id, "asistio")}
                      >
                        {t("attended")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => markAttendance(r.id, "no_asistio")}
                      >
                        {t("noShow")}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
