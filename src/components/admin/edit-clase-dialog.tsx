"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/routing";
import { formatShortDay } from "@/lib/utils";
import { findOverlappingClasses } from "@/lib/clases/helpers";
import { ScheduleOverlapDialog } from "@/components/admin/schedule-overlap-dialog";
import type { Clase, Profile } from "@/types/database";

interface EditClaseDialogProps {
  clase: Clase;
  coaches: Profile[];
  existingClases?: Clase[];
  locale: string;
  isCoach?: boolean;
  variant?: "icon" | "button";
  onUpdated?: (clase: Clase) => void;
}

export function EditClaseDialog({
  clase,
  coaches,
  existingClases = [],
  locale,
  isCoach = false,
  variant = "icon",
  onUpdated,
}: EditClaseDialogProps) {
  const t = useTranslations("classes");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [overlapOpen, setOverlapOpen] = useState(false);
  const [overlapConflicts, setOverlapConflicts] = useState<
    ReturnType<typeof findOverlappingClasses>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: clase.nombre,
    fecha: clase.fecha,
    hora_inicio: clase.hora_inicio.slice(0, 5),
    hora_fin: clase.hora_fin.slice(0, 5),
    cupo_maximo: clase.cupo_maximo,
    coach_id: clase.coach_id ?? "",
    entrenamiento: clase.entrenamiento ?? "",
  });

  const openDialog = () => {
    setForm({
      nombre: clase.nombre,
      fecha: clase.fecha,
      hora_inicio: clase.hora_inicio.slice(0, 5),
      hora_fin: clase.hora_fin.slice(0, 5),
      cupo_maximo: clase.cupo_maximo,
      coach_id: clase.coach_id ?? "",
      entrenamiento: clase.entrenamiento ?? "",
    });
    setError(null);
    setOpen(true);
  };

  const executeSave = async () => {
    setLoading(true);
    setError(null);

    if (isCoach) {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("clases")
        .update({ entrenamiento: form.entrenamiento.trim() || null })
        .eq("id", clase.id)
        .select("*")
        .single();

      setLoading(false);

      if (updateError || !data) {
        setError(updateError?.message ?? tc("error"));
        return;
      }

      onUpdated?.({
        ...clase,
        ...data,
        coach_nombre: clase.coach_nombre ?? null,
        coach_foto_url: clase.coach_foto_url ?? null,
        coach_bio: clase.coach_bio ?? null,
      });
      setOpen(false);
      router.refresh();
      return;
    }

    const res = await fetch("/api/admin/clases", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: clase.id,
        nombre: form.nombre.trim(),
        fecha: form.fecha,
        hora_inicio: form.hora_inicio,
        hora_fin: form.hora_fin,
        cupo_maximo: form.cupo_maximo,
        coach_id: form.coach_id || null,
        entrenamiento: form.entrenamiento.trim() || null,
      }),
    });
    const payload = await res.json();
    setLoading(false);

    if (!res.ok || !payload.clase) {
      setError(payload.error ?? tc("error"));
      return;
    }

    const data = payload.clase;
    const coach = coaches.find((c) => c.id === data.coach_id);
    onUpdated?.({
      ...clase,
      ...data,
      coach_nombre: coach?.nombre_completo ?? clase.coach_nombre ?? null,
      coach_foto_url: coach?.foto_url ?? clase.coach_foto_url ?? null,
      coach_bio: coach?.bio ?? clase.coach_bio ?? null,
    });
    setOverlapOpen(false);
    setOpen(false);
    router.refresh();
  };

  const handleSave = () => {
    setError(null);

    if (!isCoach && !form.nombre.trim()) {
      setError(t("classNameRequired"));
      return;
    }

    if (!isCoach && form.hora_fin <= form.hora_inicio) {
      setError(t("invalidTimeRange"));
      return;
    }

    if (!isCoach) {
      const conflicts = findOverlappingClasses(existingClases, {
        id: clase.id,
        fecha: form.fecha,
        hora_inicio: form.hora_inicio,
        hora_fin: form.hora_fin,
        estado: "programada",
      }, clase.id);

      if (conflicts.length > 0) {
        setOverlapConflicts(conflicts);
        setOverlapOpen(true);
        return;
      }
    }

    void executeSave();
  };

  return (
    <>
      {variant === "icon" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            openDialog();
          }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={openDialog}
        >
          <Pencil className="h-4 w-4" />
          {t("edit")}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t("edit")} — {clase.nombre}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {formatShortDay(clase.fecha, locale)}
          </p>
        </DialogHeader>
        <div className="space-y-3">
          {!isCoach && (
            <>
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
            </>
          )}

          <div>
            <Label>{t("workout")}</Label>
            <Textarea
              value={form.entrenamiento}
              placeholder={t("workoutPlaceholder")}
              onChange={(e) =>
                setForm({ ...form, entrenamiento: e.target.value })
              }
              rows={isCoach ? 8 : 6}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("workoutHint")}
            </p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? tc("loading") : tc("save")}
          </Button>
        </div>
      </DialogContent>
      </Dialog>
      <ScheduleOverlapDialog
        open={overlapOpen}
        onOpenChange={setOverlapOpen}
        conflicts={overlapConflicts}
        locale={locale}
        onConfirm={() => void executeSave()}
        loading={loading}
        confirmLabel={t("scheduleOverlapConfirmSave")}
      />
    </>
  );
}
