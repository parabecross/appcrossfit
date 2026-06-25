"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { computeFechaFin } from "@/lib/membresias/helpers";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/routing";
import type { Profile, Membresia, Plan, Reserva } from "@/types/database";

export function UserDetailClient({
  user,
  membresias,
  reservas,
  planes,
  locale,
}: {
  user: Profile;
  membresias: (Membresia & { plan: Plan | null })[];
  reservas: Reserva[];
  planes: Plan[];
  locale: string;
}) {
  const t = useTranslations("membership");
  const tm = useTranslations("membership.status");
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [planId, setPlanId] = useState(planes[0]?.id ?? "");
  const [fechaFin, setFechaFin] = useState("");
  const current = membresias[0];

  const assignPlan = async (manual = false) => {
    setLoading(true);
    const plan = planes.find((p) => p.id === planId);
    if (!plan) return;
    const inicio = new Date().toISOString().split("T")[0];
    const fin = manual && fechaFin
      ? fechaFin
      : computeFechaFin(inicio, plan.duracion_dias);

    await supabase.from("membresias").insert({
      usuario_id: user.id,
      plan_id: planId,
      fecha_inicio: inicio,
      fecha_fin: fin,
      metodo_asignacion: manual ? "manual" : "automatico",
      estado: "vigente",
    });

    await supabase
      .from("profiles")
      .update({ estado_cuenta: "activo" })
      .eq("id", user.id);

    router.refresh();
    setLoading(false);
  };

  const updateFechaFin = async (membresiaId: string) => {
    if (!fechaFin) return;
    setLoading(true);
    await supabase
      .from("membresias")
      .update({ fecha_fin: fechaFin })
      .eq("id", membresiaId);
    router.refresh();
    setLoading(false);
  };

  const attended = reservas.filter((r) => r.estado === "asistio").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">{user.nombre_completo}</h1>
        <p className="text-muted-foreground">{user.telefono}</p>
        {user.bio && <p className="mt-2 text-sm">{user.bio}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Asistencias</p>
            <p className="text-2xl font-black">{attended}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("currentPlan")}</p>
            <p className="text-lg font-bold">
              {current?.plan?.nombre ?? t("noMembership")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("expires")}</p>
            <p className="text-lg font-bold">
              {current
                ? formatDate(current.fecha_fin, locale)
                : "—"}
            </p>
            {current && (
              <Badge
                variant={
                  current.estado === "vigente" ? "success" : "destructive"
                }
                className="mt-2"
              >
                {tm(current.estado)}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("assignPlan")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {planes.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => assignPlan(false)} disabled={loading}>
            {t("assignPlan")}
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">{t("activateMonth")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("activateMonth")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>{t("expires")}</Label>
                  <Input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => assignPlan(true)}
                  disabled={loading}
                  className="w-full"
                >
                  {t("activateMonth")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {current && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">{t("editEndDate")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("editEndDate")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    type="date"
                    defaultValue={current.fecha_fin}
                    onChange={(e) => setFechaFin(e.target.value)}
                  />
                  <Button
                    onClick={() => updateFechaFin(current.id)}
                    disabled={loading}
                    className="w-full"
                  >
                    {t("extend")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("history")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {membresias.map((m) => (
            <div
              key={m.id}
              className="flex justify-between rounded-lg bg-secondary/30 px-3 py-2 text-sm"
            >
              <span>{m.plan?.nombre}</span>
              <span className="text-muted-foreground">
                {formatDate(m.fecha_inicio, locale)} –{" "}
                {formatDate(m.fecha_fin, locale)} · {tm(m.estado)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
