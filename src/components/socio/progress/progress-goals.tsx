"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Target } from "lucide-react";
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
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/routing";
import { formatCompactDate } from "@/lib/utils";
import type { AtletaObjetivo } from "@/types/database";

export function ProgressGoals({
  profileId,
  objetivos: initial,
  locale,
}: {
  profileId: string;
  objetivos: AtletaObjetivo[];
  locale: string;
}) {
  const t = useTranslations("progress.goals");
  const tc = useTranslations("common");
  const router = useRouter();
  const supabase = createClient();

  const [objetivos, setObjetivos] = useState(initial);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    fecha_objetivo: "",
  });

  const resetForm = () => {
    setForm({ nombre: "", fecha_objetivo: "" });
    setError(null);
  };

  const saveGoal = async () => {
    if (!form.nombre.trim()) {
      setError(t("nameRequired"));
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("atleta_objetivos")
      .insert({
        usuario_id: profileId,
        nombre: form.nombre.trim(),
        progreso_pct: 0,
        fecha_objetivo: form.fecha_objetivo || null,
        notas: null,
        estado: "en_proceso",
      })
      .select("*")
      .single();

    setLoading(false);

    if (insertError || !data) {
      setError(insertError?.message ?? tc("error"));
      return;
    }

    setObjetivos((prev) => [data as AtletaObjetivo, ...prev]);
    setOpen(false);
    resetForm();
    router.refresh();
  };

  const markComplete = async (id: string) => {
    setLoading(true);
    const { data, error: updateError } = await supabase
      .from("atleta_objetivos")
      .update({ estado: "completado" })
      .eq("id", id)
      .select("*")
      .single();

    setLoading(false);

    if (updateError || !data) {
      setError(updateError?.message ?? tc("error"));
      return;
    }

    setObjetivos((prev) =>
      prev.map((o) => (o.id === id ? (data as AtletaObjetivo) : o))
    );
    router.refresh();
  };

  if (objetivos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center space-y-4">
        <Target className="h-8 w-8 text-orange-400/60 mx-auto" />
        <p className="text-sm text-muted-foreground px-6">{t("empty")}</p>
        <Button className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          {t("add")}
        </Button>
        <GoalDialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) resetForm();
          }}
          form={form}
          setForm={setForm}
          onSave={saveGoal}
          loading={loading}
          error={error}
          t={t}
          tc={tc}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          {t("add")}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-400 text-center rounded-xl bg-red-500/10 px-4 py-2">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {objetivos.map((goal) => (
          <div
            key={goal.id}
            className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  {t("coachHelpLabel")}
                </p>
                <p className="text-sm leading-relaxed">{goal.nombre}</p>
                {goal.fecha_objetivo && (
                  <p className="text-[11px] text-muted-foreground tabular-nums mt-2">
                    {t("targetDate")}:{" "}
                    {formatCompactDate(goal.fecha_objetivo, locale)}
                  </p>
                )}
              </div>
              <Badge
                variant={
                  goal.estado === "completado"
                    ? "success"
                    : goal.estado === "en_proceso"
                      ? "warning"
                      : "secondary"
                }
              >
                {t(`status.${goal.estado}`)}
              </Badge>
            </div>

            {goal.notas && (
              <p className="text-xs text-muted-foreground">{goal.notas}</p>
            )}

            {goal.estado === "en_proceso" && (
              <Button
                size="sm"
                variant="outline"
                className="h-9 rounded-xl text-xs"
                disabled={loading}
                onClick={() => void markComplete(goal.id)}
              >
                {t("markComplete")}
              </Button>
            )}
          </div>
        ))}
      </div>

      <GoalDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) resetForm();
        }}
        form={form}
        setForm={setForm}
        onSave={saveGoal}
        loading={loading}
        error={error}
        t={t}
        tc={tc}
      />
    </div>
  );
}

function GoalDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSave,
  loading,
  error,
  t,
  tc,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: { nombre: string; fecha_objetivo: string };
  setForm: React.Dispatch<
    React.SetStateAction<{ nombre: string; fecha_objetivo: string }>
  >;
  onSave: () => void;
  loading: boolean;
  error: string | null;
  t: (key: string) => string;
  tc: (key: string) => string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-white/10 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>{t("add")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t("name")}</Label>
            <Textarea
              rows={3}
              placeholder={t("namePlaceholder")}
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </div>
          <div>
            <Label>{t("targetDate")}</Label>
            <Input
              type="date"
              value={form.fecha_objetivo}
              onChange={(e) =>
                setForm({ ...form, fecha_objetivo: e.target.value })
              }
              className="input-date-compact [color-scheme:dark]"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button onClick={onSave} disabled={loading} className="w-full">
            {loading ? tc("loading") : tc("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
