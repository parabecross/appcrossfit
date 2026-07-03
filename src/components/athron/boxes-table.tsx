"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BoxWithStats } from "@/lib/queries/athron-admin";
import type { BoxStatus } from "@/types/database";
import {
  ExternalLink,
  MoreVertical,
  Pencil,
  Power,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MENU_WIDTH = 180;

type MenuAnchor = {
  box: BoxWithStats;
  top: number;
  left: number;
};

function statusVariant(status: BoxStatus) {
  if (status === "active") return "success" as const;
  if (status === "trial") return "warning" as const;
  return "destructive" as const;
}

function athletesUsage(box: BoxWithStats): string {
  if (!box.subscription) return String(box.athleteCount);
  const { athleteUsed, athleteLimit } = box.subscription;
  return athleteLimit != null ? `${athleteUsed} / ${athleteLimit}` : `${athleteUsed}`;
}

function computeMenuPosition(rect: DOMRect) {
  const top = rect.bottom + 8;
  const left = Math.max(
    8,
    Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)
  );
  return { top, left };
}

function BoxActionsMenuPortal({
  anchor,
  onClose,
  labels,
  onToggleStatus,
  onRename,
  onDelete,
}: {
  anchor: MenuAnchor;
  onClose: () => void;
  labels: {
    activate: string;
    deactivate: string;
    editBoxName: string;
    deleteBox: string;
  };
  onToggleStatus: (box: BoxWithStats) => void;
  onRename: (box: BoxWithStats) => void;
  onDelete: (box: BoxWithStats) => void;
}) {
  const { box } = anchor;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[99999]" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/30"
        aria-label="Cerrar menú"
        onClick={onClose}
      />
      <div
        role="menu"
        className="absolute min-w-[13rem] rounded-xl border border-white/20 bg-[#1a1a1f] py-1.5 text-sm text-white shadow-2xl shadow-black"
        style={{ top: anchor.top, left: anchor.left, width: MENU_WIDTH }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-white/10"
          onClick={() => {
            onClose();
            onRename(box);
          }}
        >
          <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
          {labels.editBoxName}
        </button>
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-white/10"
          onClick={() => {
            onClose();
            onToggleStatus(box);
          }}
        >
          <Power className="h-4 w-4 shrink-0 text-muted-foreground" />
          {box.status === "active" ? labels.deactivate : labels.activate}
        </button>
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-red-400 hover:bg-red-500/10"
          onClick={() => {
            onClose();
            onDelete(box);
          }}
        >
          <Trash2 className="h-4 w-4 shrink-0" />
          {labels.deleteBox}
        </button>
      </div>
    </div>,
    document.body
  );
}

function BoxRowActions({
  box,
  loading,
  menuOpen,
  onOpenMenu,
  labels,
  compact = false,
}: {
  box: BoxWithStats;
  loading: boolean;
  menuOpen: boolean;
  onOpenMenu: (box: BoxWithStats, button: HTMLButtonElement) => void;
  labels: {
    viewDetail: string;
    actions: string;
  };
  compact?: boolean;
}) {
  const detailBase = `/admin-athron/boxes/${box.id}`;

  return (
    <div className={cn("flex items-center gap-1.5", compact ? "shrink-0" : "justify-end")}>
      <Button
        size="sm"
        variant="default"
        className={cn("h-8 gap-1.5 shrink-0", compact && "px-2.5")}
        asChild
      >
        <Link href={detailBase}>
          <ExternalLink className="h-3.5 w-3.5" />
          <span className={compact ? "sr-only" : "hidden sm:inline"}>
            {labels.viewDetail}
          </span>
        </Link>
      </Button>

      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-8 w-8 shrink-0"
        disabled={loading}
        aria-label={labels.actions}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenMenu(box, e.currentTarget);
        }}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
    </div>
  );
}

function BoxMobileCard({
  box,
  loading,
  menuOpen,
  onOpenMenu,
  labels,
  t,
}: {
  box: BoxWithStats;
  loading: boolean;
  menuOpen: boolean;
  onOpenMenu: (box: BoxWithStats, button: HTMLButtonElement) => void;
  labels: {
    viewDetail: string;
    actions: string;
  };
  t: (key: string) => string;
}) {
  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-base leading-tight">{box.name}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant={statusVariant(box.status)}>
              {t(`status_${box.status}`)}
            </Badge>
            {box.subscription?.statusLabelSuperAdmin ? (
              <Badge
                variant="outline"
                className="text-[10px] font-normal whitespace-normal text-left leading-snug"
              >
                {box.subscription.statusLabelSuperAdmin}
              </Badge>
            ) : null}
          </div>
        </div>
        <BoxRowActions
          box={box}
          loading={loading}
          menuOpen={menuOpen}
          onOpenMenu={onOpenMenu}
          labels={labels}
          compact
        />
      </div>

      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-muted-foreground mb-0.5">{t("saasPlan")}</dt>
          <dd className="font-medium leading-snug">
            {box.subscription?.displayPlanName ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground mb-0.5">{t("athletesUsageLimit")}</dt>
          <dd className="font-medium tabular-nums">{athletesUsage(box)}</dd>
        </div>
      </dl>
    </article>
  );
}

export function AthronBoxesTable({
  boxes,
}: {
  boxes: BoxWithStats[];
  locale: string;
}) {
  const t = useTranslations("athronAdmin");
  const tc = useTranslations("common");
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BoxWithStats | null>(null);
  const [renameTarget, setRenameTarget] = useState<BoxWithStats | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmSlug, setConfirmSlug] = useState("");
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const closeMenu = useCallback(() => setMenuAnchor(null), []);

  const openMenu = useCallback((box: BoxWithStats, button: HTMLButtonElement) => {
    if (menuAnchor?.box.id === box.id) {
      setMenuAnchor(null);
      return;
    }
    const rect = button.getBoundingClientRect();
    const { top, left } = computeMenuPosition(rect);
    setMenuAnchor({ box, top, left });
  }, [menuAnchor?.box.id]);

  const actionLabels = {
    activate: t("activate"),
    deactivate: t("deactivate"),
    editBoxName: t("editBoxName"),
    deleteBox: t("deleteBox"),
    viewDetail: t("viewDetail"),
    actions: tc("actions"),
  };

  const toggleStatus = async (box: BoxWithStats) => {
    const next: BoxStatus = box.status === "active" ? "inactive" : "active";
    setLoadingId(box.id);
    setError(null);

    const res = await fetch(`/api/admin-athron/boxes/${box.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? tc("error"));
      setLoadingId(null);
      return;
    }

    router.refresh();
    setLoadingId(null);
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const trimmed = renameDraft.trim();
    if (!trimmed || trimmed === renameTarget.name) {
      setRenameTarget(null);
      return;
    }

    setLoadingId(renameTarget.id);
    setError(null);

    const res = await fetch(`/api/admin-athron/boxes/${renameTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? tc("error"));
      setLoadingId(null);
      return;
    }

    setRenameTarget(null);
    setRenameDraft("");
    setLoadingId(null);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setLoadingId(deleteTarget.id);
    setError(null);

    const res = await fetch(`/api/admin-athron/boxes/${deleteTarget.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmSlug }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? tc("error"));
      setLoadingId(null);
      return;
    }

    setDeleteTarget(null);
    setConfirmSlug("");
    setLoadingId(null);
    router.refresh();
  };

  if (boxes.length === 0) {
    return <p className="text-muted-foreground text-sm">{tc("noData")}</p>;
  }

  const slugMatches =
    deleteTarget &&
    confirmSlug.trim().toLowerCase() === deleteTarget.slug.toLowerCase();

  return (
    <div className="space-y-4">
      {error && !deleteTarget && !renameTarget && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <div className="md:hidden space-y-3">
        {boxes.map((box) => (
          <BoxMobileCard
            key={box.id}
            box={box}
            loading={loadingId === box.id}
            menuOpen={menuAnchor?.box.id === box.id}
            onOpenMenu={openMenu}
            labels={{
              viewDetail: actionLabels.viewDetail,
              actions: actionLabels.actions,
            }}
            t={t}
          />
        ))}
      </div>

      <div className="hidden md:block rounded-xl border border-white/10 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5 text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">{t("boxName")}</th>
              <th className="px-4 py-3 font-medium">{t("boxOperationalStatus")}</th>
              <th className="px-4 py-3 font-medium">{t("saasPlan")}</th>
              <th className="px-4 py-3 font-medium">{t("subscriptionStatus")}</th>
              <th className="px-4 py-3 font-medium">{t("athletesUsageLimit")}</th>
              <th className="px-4 py-3 font-medium text-right min-w-[9.5rem]">
                {tc("actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {boxes.map((box) => (
              <tr
                key={box.id}
                className="border-b border-white/5 hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3 font-medium max-w-[12rem] truncate">
                  {box.name}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(box.status)}>
                    {t(`status_${box.status}`)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {box.subscription?.displayPlanName ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {box.subscription?.statusLabelSuperAdmin ? (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {box.subscription.statusLabelSuperAdmin}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {athletesUsage(box)}
                </td>
                <td className="px-4 py-3 text-right">
                  <BoxRowActions
                    box={box}
                    loading={loadingId === box.id}
                    menuOpen={menuAnchor?.box.id === box.id}
                    onOpenMenu={openMenu}
                    labels={{
                      viewDetail: actionLabels.viewDetail,
                      actions: actionLabels.actions,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mounted && menuAnchor && (
        <BoxActionsMenuPortal
          anchor={menuAnchor}
          onClose={closeMenu}
          labels={actionLabels}
          onToggleStatus={(box) => void toggleStatus(box)}
          onRename={(box) => {
            setRenameTarget(box);
            setRenameDraft(box.name);
            setError(null);
          }}
          onDelete={(box) => {
            setDeleteTarget(box);
            setConfirmSlug("");
            setError(null);
          }}
        />
      )}

      <Dialog
        open={!!renameTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
            setRenameDraft("");
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editBoxName")}</DialogTitle>
          </DialogHeader>
          {renameTarget && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="rename-box">{t("boxNameLabel")}</Label>
                <Input
                  id="rename-box"
                  className="mt-2"
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  maxLength={80}
                  autoComplete="off"
                />
              </div>
              {error && renameTarget && (
                <p className="text-sm text-red-400">{error}</p>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setRenameTarget(null)}
                  disabled={loadingId === renameTarget.id}
                >
                  {tc("cancel")}
                </Button>
                <Button
                  onClick={() => void handleRename()}
                  disabled={
                    !renameDraft.trim() ||
                    renameDraft.trim() === renameTarget.name ||
                    loadingId === renameTarget.id
                  }
                >
                  {loadingId === renameTarget.id
                    ? tc("loading")
                    : t("saveBoxName")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setConfirmSlug("");
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteBox")}</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("deleteBoxConfirm", { name: deleteTarget.name })}
              </p>
              <p className="text-sm text-red-400">{t("deleteBoxWarning")}</p>
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                <li>{t("deleteBoxScopeUsers", { count: deleteTarget.memberCount })}</li>
                <li>{t("deleteBoxScopeClasses", { count: deleteTarget.classCount })}</li>
                <li>{t("deleteBoxScopeBookings", { count: deleteTarget.reservationCount })}</li>
              </ul>
              <div>
                <Label htmlFor="confirm-slug">{t("deleteBoxSlugLabel")}</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  {t("deleteBoxSlugHint", { slug: deleteTarget.slug })}
                </p>
                <Input
                  id="confirm-slug"
                  value={confirmSlug}
                  onChange={(e) => setConfirmSlug(e.target.value)}
                  placeholder={deleteTarget.slug}
                  autoComplete="off"
                />
              </div>
              {error && deleteTarget && (
                <p className="text-sm text-red-400">{error}</p>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setDeleteTarget(null)}
                  disabled={loadingId === deleteTarget.id}
                >
                  {tc("cancel")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void handleDelete()}
                  disabled={!slugMatches || loadingId === deleteTarget.id}
                >
                  {loadingId === deleteTarget.id
                    ? tc("loading")
                    : t("deleteBoxForever")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
