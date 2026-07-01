"use client";

import { useState } from "react";
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
import { formatDate } from "@/lib/utils";
import type { BoxWithStats } from "@/lib/queries/athron-admin";
import type { BoxStatus } from "@/types/database";
import { ExternalLink, Power, Trash2 } from "lucide-react";

function statusVariant(status: BoxStatus) {
  if (status === "active") return "success" as const;
  if (status === "trial") return "warning" as const;
  return "destructive" as const;
}

export function AthronBoxesTable({
  boxes,
  locale,
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
  const [confirmSlug, setConfirmSlug] = useState("");

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

  const openDelete = (box: BoxWithStats) => {
    setDeleteTarget(box);
    setConfirmSlug("");
    setError(null);
  };

  if (boxes.length === 0) {
    return <p className="text-muted-foreground text-sm">{tc("noData")}</p>;
  }

  const slugMatches =
    deleteTarget &&
    confirmSlug.trim().toLowerCase() === deleteTarget.slug.toLowerCase();

  return (
    <div className="space-y-4">
      {error && !deleteTarget && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5 text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">{t("boxName")}</th>
              <th className="px-4 py-3 font-medium">{t("status")}</th>
              <th className="px-4 py-3 font-medium">{t("plan")}</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">
                {t("registered")}
              </th>
              <th className="px-4 py-3 font-medium text-center">{t("athletes")}</th>
              <th className="px-4 py-3 font-medium text-center hidden md:table-cell">
                {t("coaches")}
              </th>
              <th className="px-4 py-3 font-medium text-center hidden lg:table-cell">
                {t("classes")}
              </th>
              <th className="px-4 py-3 font-medium text-center hidden lg:table-cell">
                {t("bookings")}
              </th>
              <th className="px-4 py-3 font-medium hidden xl:table-cell">
                {t("lastAccess")}
              </th>
              <th className="px-4 py-3 font-medium text-right">{tc("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {boxes.map((box) => (
              <tr
                key={box.id}
                className="border-b border-white/5 hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3 font-medium">{box.name}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(box.status)}>
                    {t(`status_${box.status}`)}
                  </Badge>
                </td>
                <td className="px-4 py-3 capitalize text-muted-foreground">
                  {box.plan}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                  {formatDate(box.created_at.split("T")[0], locale)}
                </td>
                <td className="px-4 py-3 text-center">{box.athleteCount}</td>
                <td className="px-4 py-3 text-center hidden md:table-cell">
                  {box.coachCount}
                </td>
                <td className="px-4 py-3 text-center hidden lg:table-cell">
                  {box.classCount}
                </td>
                <td className="px-4 py-3 text-center hidden lg:table-cell">
                  {box.reservationCount}
                </td>
                <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs">
                  {box.lastAccess
                    ? formatDate(box.lastAccess.split("T")[0], locale)
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={loadingId === box.id}
                      onClick={() => toggleStatus(box)}
                      className="gap-1.5"
                    >
                      <Power className="h-3.5 w-3.5" />
                      {box.status === "active" ? t("deactivate") : t("activate")}
                    </Button>
                    {box.status !== "active" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={loadingId === box.id}
                        onClick={() => openDelete(box)}
                        className="gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{t("deleteBox")}</span>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/admin-athron/boxes/${box.id}`} className="gap-1">
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{t("viewDetail")}</span>
                      </Link>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
