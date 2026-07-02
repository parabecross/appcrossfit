"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditClaseDialog } from "@/components/admin/edit-clase-dialog";
import { DeleteClaseDialog } from "@/components/admin/delete-clase-dialog";
import { AdminClassDetailDialog } from "@/components/admin/clases/admin-class-detail-dialog";
import type { Clase, Profile } from "@/types/database";

export function AdminClassActionsMenu({
  clase,
  coaches,
  existingClases,
  locale,
  occupied,
  canEdit,
  onUpdated,
  onDeleted,
  onSelect,
}: {
  clase: Clase;
  coaches: Profile[];
  existingClases: Clase[];
  locale: string;
  occupied: number;
  canEdit: boolean;
  onUpdated?: (clase: Clase) => void;
  onDeleted?: () => void;
  onSelect?: () => void;
}) {
  const t = useTranslations("classes");
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem
            onClick={() => {
              setDetailOpen(true);
              onSelect?.();
            }}
          >
            <Eye className="h-4 w-4" />
            {t("viewDetail")}
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              {t("edit")}
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem
              className="text-red-400 focus:text-red-300"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              {t("deleteClass")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AdminClassDetailDialog
        clase={clase}
        occupied={occupied}
        locale={locale}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      {canEdit && (
        <>
          <EditClaseDialog
            clase={clase}
            coaches={coaches}
            existingClases={existingClases}
            locale={locale}
            hideTrigger
            open={editOpen}
            onOpenChange={setEditOpen}
            onUpdated={onUpdated}
          />
          <DeleteClaseDialog
            claseId={clase.id}
            nombre={clase.nombre}
            fecha={clase.fecha}
            locale={locale}
            enrolledCount={occupied}
            hideTrigger
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            onDeleted={onDeleted}
          />
        </>
      )}
    </>
  );
}
