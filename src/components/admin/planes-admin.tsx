"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { useRouter } from "@/i18n/routing";
import type { Plan } from "@/types/database";

export function PlanesAdmin({
  planes,
}: {
  planes: Plan[];
  boxId: string;
}) {
  const t = useTranslations("plans");
  const tt = useTranslations("plans.types");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    tipo: "mensual_fijo" as Plan["tipo"],
    duracion_dias: 30,
    precio: "",
  });

  const createPlan = async () => {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/planes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: form.nombre,
        tipo: form.tipo,
        duracion_dias: form.duracion_dias,
        precio: form.precio ? parseFloat(form.precio) : null,
      }),
    });
    const payload = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(payload.error ?? tc("error"));
      return;
    }

    setOpen(false);
    router.refresh();
  };

  const toggleActive = async (plan: Plan) => {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/planes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: plan.id, activo: !plan.activo }),
    });
    const payload = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(payload.error ?? tc("error"));
      return;
    }

    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <h1 className="text-3xl font-black brand-text">{t("title")}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Create plan</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create plan</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("name")}</Label>
                <Input
                  value={form.nombre}
                  onChange={(e) =>
                    setForm({ ...form, nombre: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{t("type")}</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) =>
                    setForm({ ...form, tipo: v as Plan["tipo"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensual_fijo">
                      {tt("mensual_fijo")}
                    </SelectItem>
                    <SelectItem value="convenio_externo">
                      {tt("convenio_externo")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("duration")}</Label>
                <Input
                  type="number"
                  value={form.duracion_dias}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      duracion_dias: parseInt(e.target.value, 10),
                    })
                  }
                />
              </div>
              <div>
                <Label>{t("price")}</Label>
                <Input
                  type="number"
                  value={form.precio}
                  onChange={(e) =>
                    setForm({ ...form, precio: e.target.value })
                  }
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button onClick={() => void createPlan()} className="w-full" disabled={loading}>
                {loading ? tc("loading") : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && !open && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {planes.map((p) => (
          <div
            key={p.id}
            className="glass-card p-5 flex flex-col gap-3"
          >
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-lg">{p.nombre}</h3>
              <Badge variant={p.activo ? "success" : "secondary"}>
                {p.activo ? t("active") : "Inactive"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {tt(p.tipo)} · {p.duracion_dias}d
              {p.precio != null && ` · $${p.precio}`}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void toggleActive(p)}
              disabled={loading}
            >
              {p.activo ? "Deactivate" : "Activate"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
