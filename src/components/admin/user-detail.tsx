"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { computeFechaFin, syncMembresiaEstadoLocal } from "@/lib/membresias/helpers";
import { useRouter } from "@/i18n/routing";
import type { Profile, Membresia, Plan } from "@/types/database";
import type { AthleteClassHistoryItem } from "@/lib/queries/athlete-history";
import { DeleteSocioDialog } from "@/components/admin/delete-socio-dialog";
import { MembershipExpiryAlert } from "@/components/admin/membership-expiry-alert";
import { ClassHistoryList } from "@/components/clases/class-history-list";
import { FeatureGate } from "@/components/plans/feature-gate";
import type { BoxEntitlements } from "@/lib/entitlements/types";

export function UserDetailClient({
  user,
  email: initialEmail,
  membresias,
  classHistory,
  planes,
  locale,
  entitlements,
}: {
  user: Profile;
  email: string | null;
  membresias: (Membresia & { plan: Plan | null })[];
  classHistory: AthleteClassHistoryItem[];
  planes: Plan[];
  locale: string;
  entitlements: BoxEntitlements;
}) {
  const t = useTranslations("membership");
  const tm = useTranslations("membership.status");
  const ta = useTranslations("admin");
  const tc = useTranslations("common");
  const tauth = useTranslations("auth");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [telefono, setTelefono] = useState(user.telefono ?? "");
  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    email: initialEmail ?? "",
    telefono: user.telefono ?? "",
  });
  const [planId, setPlanId] = useState(planes[0]?.id ?? "");
  const [activateOpen, setActivateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activateFechaFin, setActivateFechaFin] = useState("");
  const [editPlanId, setEditPlanId] = useState("");
  const [editFechaInicio, setEditFechaInicio] = useState("");
  const [editFechaFin, setEditFechaFin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const current = membresias[0];
  const currentEstado = current
    ? syncMembresiaEstadoLocal(current.fecha_fin, current.estado)
    : null;
  const hasActiveMembership = currentEstado === "vigente";
  const canEditMembership =
    !!current && current.estado !== "cancelada";

  const openEditDialog = () => {
    if (!current) return;
    setError(null);
    setEditPlanId(current.plan_id);
    setEditFechaInicio(current.fecha_inicio);
    setEditFechaFin(current.fecha_fin);
    setEditOpen(true);
  };

  const getSelectedPlan = () => planes.find((p) => p.id === planId);

  const defaultFechaFin = () => {
    const plan = getSelectedPlan() ?? planes[0];
    const inicio = new Date().toISOString().split("T")[0];
    return computeFechaFin(inicio, plan?.duracion_dias ?? 30);
  };

  const openContactDialog = () => {
    setError(null);
    setContactForm({ email, telefono });
    setContactOpen(true);
  };

  const saveContact = async () => {
    if (!contactForm.email.trim()) {
      setError(ta("contactEmailRequired"));
      return;
    }

    setLoading(true);
    setError(null);
    setContactSuccess(false);

    try {
      const res = await fetch("/api/admin/usuario", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.user_id,
          email: contactForm.email.trim(),
          telefono: contactForm.telefono.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? tc("error"));
        return;
      }
      setEmail(data.email ?? contactForm.email.trim());
      setTelefono(contactForm.telefono.trim());
      setContactSuccess(true);
      setContactOpen(false);
      router.refresh();
    } catch {
      setError(tc("error"));
    } finally {
      setLoading(false);
    }
  };

  const callMembresiaApi = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/admin/membresia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: { error?: string } = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(tc("error"));
    }
    if (!res.ok) {
      throw new Error(data.error ?? tc("error"));
    }
    return data;
  };

  const assignPlan = async (manual = false) => {
    setError(null);
    setSuccess(false);

    if (!planId) {
      setError(t("selectPlan"));
      return;
    }

    if (manual && !activateFechaFin) {
      setError(t("invalidDate"));
      return;
    }

    setLoading(true);
    try {
      await callMembresiaApi({
        action: "assign",
        usuario_id: user.id,
        plan_id: planId,
        manual,
        fecha_fin: manual ? activateFechaFin : undefined,
      });
      setSuccess(true);
      setActivateOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : tc("error"));
    } finally {
      setLoading(false);
    }
  };

  const updateMembership = async () => {
    if (!current) return;
    setError(null);
    setSuccess(false);

    if (!editPlanId) {
      setError(t("selectPlan"));
      return;
    }

    if (!editFechaInicio || !editFechaFin) {
      setError(t("invalidDate"));
      return;
    }

    if (editFechaFin < editFechaInicio) {
      setError(t("invalidDate"));
      return;
    }

    setLoading(true);
    try {
      await callMembresiaApi({
        action: "update",
        membresia_id: current.id,
        plan_id: editPlanId,
        fecha_inicio: editFechaInicio,
        fecha_fin: editFechaFin,
      });
      setSuccess(true);
      setEditOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : tc("error"));
    } finally {
      setLoading(false);
    }
  };

  const attended = classHistory.filter((r) => r.estado === "asistio").length;
  const noShow = classHistory.filter((r) => r.estado === "no_asistio").length;
  const upcoming = classHistory.filter((r) => r.estado === "confirmada").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">{user.nombre_completo}</h1>
          <p className="text-muted-foreground">
            {email || "—"} · {telefono || ta("noPhoneForWhatsApp")}
          </p>
          {user.bio && <p className="mt-2 text-sm">{user.bio}</p>}
        </div>
        {user.rol === "socio" && (
          <DeleteSocioDialog
            userId={user.user_id}
            nombre={user.nombre_completo}
            variant="button"
            redirectAfterDelete
          />
        )}
      </div>

      {contactSuccess && (
        <p className="text-sm text-green-400">{ta("contactUpdated")}</p>
      )}
      {success && (
        <p className="text-sm text-green-400">{t("assignSuccess")}</p>
      )}
      {error && !activateOpen && !editOpen && !contactOpen && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {user.rol === "socio" && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>{ta("contactInfo")}</CardTitle>
              <CardDescription>{ta("editContactDesc")}</CardDescription>
            </div>
            <Dialog
              open={contactOpen}
              onOpenChange={(open) => {
                if (open) openContactDialog();
                else setContactOpen(false);
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  {ta("editContact")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{ta("editContact")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>{tauth("email")}</Label>
                    <Input
                      type="email"
                      value={contactForm.email}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, email: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>{tauth("phone")}</Label>
                    <Input
                      value={contactForm.telefono}
                      onChange={(e) =>
                        setContactForm({
                          ...contactForm,
                          telefono: e.target.value,
                        })
                      }
                    />
                  </div>
                  {error && contactOpen && (
                    <p className="text-sm text-red-400">{error}</p>
                  )}
                  <Button
                    onClick={saveContact}
                    disabled={loading || !contactForm.email.trim()}
                    className="w-full"
                  >
                    {loading ? tc("loading") : tc("save")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-muted-foreground">{tauth("email")}</p>
              <p className="font-medium">{email || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{tauth("phone")}</p>
              <p className="font-medium">{telefono || "—"}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {current?.fecha_fin && user.rol === "socio" && (
        <MembershipExpiryAlert
          nombre={user.nombre_completo}
          telefono={user.telefono}
          fechaFin={current.fecha_fin}
          locale={locale}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{ta("attendanceCount")}</p>
            <p className="text-2xl font-black">{attended}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{ta("noShowCount")}</p>
            <p className="text-2xl font-black">{noShow}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{ta("upcomingBookings")}</p>
            <p className="text-2xl font-black">{upcoming}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("currentPlan")}</p>
            <p className="text-lg font-bold">
              {current?.plan?.nombre ?? t("noMembership")}
            </p>
            {current && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("expires")}: {formatDate(current.fecha_fin, locale)}
              </p>
            )}
            {currentEstado && (
              <Badge
                variant={currentEstado === "vigente" ? "success" : "destructive"}
                className="mt-2"
              >
                {tm(currentEstado)}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {current ? t("manageMembership") : t("assignPlan")}
          </CardTitle>
          <CardDescription>
            {current
              ? hasActiveMembership
                ? t("manageActiveDesc")
                : t("manageExpiredDesc")
              : t("assignPlanDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {planes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tc("noData")}</p>
          ) : canEditMembership ? (
            <Dialog
              open={editOpen}
              onOpenChange={(open) => {
                if (open) openEditDialog();
                else setEditOpen(false);
              }}
            >
              <DialogTrigger asChild>
                <Button>{t("editMembership")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("editMembership")}</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  {t("editMembershipDesc")}
                </p>
                <div className="space-y-3">
                  <div>
                    <Label>{t("currentPlan")}</Label>
                    <Select value={editPlanId} onValueChange={setEditPlanId}>
                      <SelectTrigger>
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
                  </div>
                  <div>
                    <Label htmlFor="edit-fecha-inicio">{t("startDate")}</Label>
                    <Input
                      id="edit-fecha-inicio"
                      type="date"
                      value={editFechaInicio}
                      onChange={(e) => setEditFechaInicio(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-fecha-fin">{t("expires")}</Label>
                    <Input
                      id="edit-fecha-fin"
                      type="date"
                      value={editFechaFin}
                      onChange={(e) => setEditFechaFin(e.target.value)}
                    />
                  </div>
                  {error && editOpen && (
                    <p className="text-sm text-red-400">{error}</p>
                  )}
                  <Button
                    type="button"
                    onClick={updateMembership}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? tc("loading") : tc("save")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <>
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
              <div className="flex flex-col gap-1">
                <Button
                  onClick={() => assignPlan(false)}
                  disabled={loading || !planId}
                >
                  {loading ? tc("loading") : t("assignPlanAuto")}
                </Button>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {t("assignPlanAutoDesc")}
                </p>
              </div>
              <Dialog
                open={activateOpen}
                onOpenChange={(open) => {
                  if (open) {
                    setError(null);
                    setActivateFechaFin(defaultFechaFin());
                  }
                  setActivateOpen(open);
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline">{t("activateMonth")}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("activateMonth")}</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    {t("activateMonthDesc")}
                  </p>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="activate-fecha-fin">{t("expires")}</Label>
                      <Input
                        id="activate-fecha-fin"
                        name="activate-fecha-fin"
                        type="date"
                        value={activateFechaFin}
                        onChange={(e) => setActivateFechaFin(e.target.value)}
                      />
                    </div>
                    {error && activateOpen && (
                      <p className="text-sm text-red-400">{error}</p>
                    )}
                    <Button
                      type="button"
                      onClick={() => assignPlan(true)}
                      disabled={loading || !planId}
                      className="w-full"
                    >
                      {loading ? tc("loading") : t("activateMonth")}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </CardContent>
      </Card>

      <FeatureGate
        entitlements={entitlements}
        featureKey="historial_completo"
        title={ta("classHistory")}
        description={ta("classHistoryDesc")}
      >
      <Card>
        <CardHeader>
          <CardTitle>{ta("classHistory")}</CardTitle>
          <CardDescription>
            {ta("classHistoryDesc")}
            {classHistory.length > 0 && (
              <span className="mt-1 block font-medium text-foreground/80">
                {ta("classHistorySummary", {
                  attended,
                  noShow,
                  upcoming,
                })}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {classHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">{ta("noClassHistory")}</p>
          ) : (
            <ClassHistoryList items={classHistory} locale={locale} />
          )}
        </CardContent>
      </Card>
      </FeatureGate>

      <Card>
        <CardHeader>
          <CardTitle>{ta("membershipHistory")}</CardTitle>
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
