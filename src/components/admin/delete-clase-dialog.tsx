"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRouter } from "@/i18n/routing";
import { formatShortDay } from "@/lib/utils";

interface DeleteClaseDialogProps {
  claseId: string;
  nombre: string;
  fecha: string;
  locale: string;
  enrolledCount?: number;
  variant?: "icon" | "button";
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteClaseDialog({
  claseId,
  nombre,
  fecha,
  locale,
  enrolledCount = 0,
  variant = "button",
  hideTrigger = false,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onDeleted,
}: DeleteClaseDialogProps) {
  const t = useTranslations("classes");
  const tc = useTranslations("common");
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/clases", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: claseId }),
    });
    const payload = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(payload.error ?? tc("error"));
      return;
    }

    setOpen(false);
    onDeleted?.();
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          {variant === "icon" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              {t("deleteClass")}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteClass")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("deleteClassConfirm", {
              name: nombre,
              date: formatShortDay(fecha, locale),
            })}
          </p>
          {enrolledCount > 0 && (
            <p className="text-sm text-orange-400">{t("deleteClassWarning")}</p>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? tc("loading") : t("deleteClass")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
