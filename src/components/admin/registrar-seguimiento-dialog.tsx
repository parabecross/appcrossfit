"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
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
import {
  SEGUIMIENTO_NOTA_MAX,
  SEGUIMIENTO_RESULTADOS,
  SEGUIMIENTO_TIPOS,
} from "@/lib/seguimientos/helpers";
import type {
  SeguimientoResultado,
  SeguimientoTipoInteraccion,
} from "@/types/database";

function toLocalInputValue(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RegistrarSeguimientoDialog({
  athleteId,
  athleteName,
  defaultTipo = "whatsapp",
  defaultResultado = "contacted",
  triggerLabel,
  open: controlledOpen,
  onOpenChange,
}: {
  athleteId: string;
  athleteName: string;
  defaultTipo?: SeguimientoTipoInteraccion;
  defaultResultado?: SeguimientoResultado;
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("admin.athletesInbox.seguimiento");
  const tc = useTranslations("common");
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [tipo, setTipo] = useState<SeguimientoTipoInteraccion>(defaultTipo);
  const [resultado, setResultado] =
    useState<SeguimientoResultado>(defaultResultado);
  const [nota, setNota] = useState("");
  const [occurredAt, setOccurredAt] = useState(toLocalInputValue());
  const [requiresFollowUp, setRequiresFollowUp] = useState(false);
  const [followUpAt, setFollowUpAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setTipo(defaultTipo);
    setResultado(defaultResultado);
    setNota("");
    setOccurredAt(toLocalInputValue());
    setRequiresFollowUp(false);
    setFollowUpAt("");
    setError(null);
    setSuccess(false);
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/admin/seguimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: athleteId,
          tipo_interaccion: tipo,
          resultado,
          nota: nota.trim() || null,
          occurred_at: new Date(occurredAt).toISOString(),
          requires_follow_up: requiresFollowUp,
          follow_up_at: requiresFollowUp
            ? new Date(followUpAt).toISOString()
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? tc("error"));
        return;
      }
      setSuccess(true);
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      setError(tc("error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
        else {
          setTipo(defaultTipo);
          setResultado(defaultResultado);
          setOccurredAt(toLocalInputValue());
        }
      }}
    >
      {controlledOpen == null ? (
        <DialogTrigger asChild>
          <Button variant="outline" className="min-h-11">
            {triggerLabel ?? t("register")}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t("registerTitle", { name: athleteName })}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{t("privacyNotice")}</p>
        <div className="space-y-3">
          <div>
            <Label>{t("type")}</Label>
            <Select
              value={tipo}
              onValueChange={(v) => setTipo(v as SeguimientoTipoInteraccion)}
            >
              <SelectTrigger className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEGUIMIENTO_TIPOS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {t(`types.${key}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("outcome")}</Label>
            <Select
              value={resultado}
              onValueChange={(v) => setResultado(v as SeguimientoResultado)}
            >
              <SelectTrigger className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEGUIMIENTO_RESULTADOS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {t(`outcomes.${key}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="seg-occurred">{t("occurredAt")}</Label>
            <Input
              id="seg-occurred"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="min-h-11 text-base"
            />
          </div>
          <div>
            <Label htmlFor="seg-nota">
              {t("note")} ({t("optional")})
            </Label>
            <textarea
              id="seg-nota"
              value={nota}
              maxLength={SEGUIMIENTO_NOTA_MAX}
              onChange={(e) => setNota(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base min-h-[88px]"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {nota.length}/{SEGUIMIENTO_NOTA_MAX}
            </p>
          </div>
          <label className="flex items-center gap-2 min-h-11 text-sm">
            <input
              type="checkbox"
              checked={requiresFollowUp}
              onChange={(e) => setRequiresFollowUp(e.target.checked)}
              className="h-4 w-4"
            />
            {t("requiresFollowUp")}
          </label>
          {requiresFollowUp ? (
            <div>
              <Label htmlFor="seg-follow">{t("followUpAt")}</Label>
              <Input
                id="seg-follow"
                type="datetime-local"
                value={followUpAt}
                onChange={(e) => setFollowUpAt(e.target.value)}
                className="min-h-11 text-base"
              />
            </div>
          ) : null}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {success ? (
            <p className="text-sm text-green-400">{t("saved")}</p>
          ) : null}
          <Button
            type="button"
            onClick={submit}
            disabled={loading || (requiresFollowUp && !followUpAt)}
            className="w-full min-h-11"
          >
            {loading ? tc("loading") : t("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
