"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { MoreHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { todayInTimezone } from "@/lib/dates/date-only";
import type { AthleteInboxRow } from "@/lib/queries/admin-usuarios-inbox";
import {
  buildUsuariosInboxHref,
  encodeUsuariosReturnParam,
  filterAthleteInboxRows,
  type UsuariosInboxFilters,
  type UsuariosInboxView,
} from "@/lib/admin/usuarios-filters";
import {
  buildAttentionPriorities,
  countAttentionKpis,
  formatLastAttendanceLabel,
  formatMembershipSummary,
  resolveAttentionCenterStatus,
  type AttentionCenterStatus,
} from "@/lib/admin/attention-center-display";
import { DeleteSocioDialog } from "@/components/admin/delete-socio-dialog";
import { WhatsAppReminderButton } from "@/components/admin/whatsapp-reminder-button";

function initials(nombre: string) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function StatusBadge({
  status,
  labels,
}: {
  status: AttentionCenterStatus;
  labels: Record<AttentionCenterStatus, string>;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md",
        status === "activo" && "bg-emerald-500/15 text-emerald-400",
        status === "por_vencer" && "bg-amber-500/15 text-amber-300",
        status === "vencido" && "bg-red-500/15 text-red-400",
        status === "sin_asistir" && "bg-white/10 text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "activo" && "bg-emerald-400",
          status === "por_vencer" && "bg-amber-400",
          status === "vencido" && "bg-red-400",
          status === "sin_asistir" && "bg-zinc-400"
        )}
        aria-hidden
      />
      {labels[status]}
    </span>
  );
}

const KPI_VIEWS: Array<{
  view: UsuariosInboxView;
  key: "total" | "active" | "expiring" | "expired" | "inactive";
  accent: string;
}> = [
  { view: "all", key: "total", accent: "border-white/10" },
  { view: "active", key: "active", accent: "border-emerald-500/30" },
  { view: "membership_expiring", key: "expiring", accent: "border-amber-500/30" },
  { view: "membership_expired", key: "expired", accent: "border-red-500/30" },
  { view: "inactive", key: "inactive", accent: "border-zinc-500/30" },
];

export function UsuariosTable({
  rows,
  locale,
  gymTimezone,
  boxName,
  initialFilters,
}: {
  rows: AthleteInboxRow[];
  locale: string;
  gymTimezone?: string;
  boxName: string;
  initialFilters: UsuariosInboxFilters;
  /** Kept for page compatibility; KPIs are derived client-side from rows. */
  viewCounts?: Record<UsuariosInboxView, number>;
}) {
  const t = useTranslations("admin");
  const tinbox = useTranslations("admin.athletesInbox");
  const tauth = useTranslations("auth");
  const tc = useTranslations("common");
  const [search, setSearch] = useState(initialFilters.q);
  const [view, setView] = useState<UsuariosInboxView>(initialFilters.view);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    nombre: "",
    telefono: "",
    rol: "socio",
  });
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const emptyForm = {
    email: "",
    password: "",
    nombre: "",
    telefono: "",
    rol: "socio" as const,
  };

  const today = todayInTimezone(gymTimezone);
  const kpis = useMemo(() => countAttentionKpis(rows), [rows]);
  const priorities = useMemo(() => buildAttentionPriorities(rows), [rows]);

  const filtered = useMemo(
    () =>
      filterAthleteInboxRows(rows, {
        view,
        q: search,
      }),
    [rows, view, search]
  );

  const statusLabels: Record<AttentionCenterStatus, string> = {
    activo: tinbox("status.active"),
    por_vencer: tinbox("status.expiring"),
    vencido: tinbox("status.expired"),
    sin_asistir: tinbox("status.inactive"),
  };

  const syncUrl = (next: UsuariosInboxFilters) => {
    startTransition(() => {
      router.replace(buildUsuariosInboxHref(next));
    });
  };

  const onViewChange = (nextView: UsuariosInboxView) => {
    setView(nextView);
    syncUrl({ view: nextView, q: search });
  };

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    syncUrl({ view, q: search });
  };

  const clearFilters = () => {
    setView("all");
    setSearch("");
    syncUrl({ view: "all", q: "" });
  };

  const returnParam = encodeUsuariosReturnParam({ view, q: search });

  const createUser = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/crear-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? tc("error"));
        return;
      }
      setForm(emptyForm);
      setCreateOpen(false);
      router.refresh();
    } catch {
      setError(tc("error"));
    } finally {
      setCreating(false);
    }
  };

  const emptyMessage =
    view !== "all"
      ? tinbox(`empty.${view}` as never)
      : search
        ? tinbox("empty.search")
        : tinbox("empty.all");

  const attendanceLabel = (days: number | null) =>
    formatLastAttendanceLabel(days, {
      today: tinbox("attendance.today"),
      daysAgo: (n) => tinbox("attendance.daysAgo", { days: n }),
      never: tinbox("attendance.never"),
    });

  const membershipLabel = (u: AthleteInboxRow) =>
    formatMembershipSummary(
      {
        membershipStatus: u.membershipStatus,
        fechaFin: u.fechaFin,
        today,
      },
      {
        active: tinbox("membershipLine.active"),
        expiresIn: (days) => tinbox("membershipLine.expiresIn", { days }),
        expiredAgo: (days) => tinbox("membershipLine.expiredAgo", { days }),
        none: tinbox("membershipLine.none"),
      }
    );

  const profileHref = (id: string) =>
    `/admin/usuarios/${id}${returnParam ? `?ret=${encodeURIComponent(returnParam)}` : ""}`;

  const priorityItems = [
    {
      show: priorities.inactive > 0,
      text: tinbox("priorities.inactive", { count: priorities.inactive }),
      view: "inactive" as const,
    },
    {
      show: priorities.expiring > 0,
      text: tinbox("priorities.expiring", { count: priorities.expiring }),
      view: "membership_expiring" as const,
    },
    {
      show: priorities.expired > 0,
      text: tinbox("priorities.expired", { count: priorities.expired }),
      view: "membership_expired" as const,
    },
    {
      show: priorities.newWithoutBooking > 0,
      text: tinbox("priorities.newWithoutBooking", {
        count: priorities.newWithoutBooking,
      }),
      view: "new_without_booking" as const,
    },
  ].filter((p) => p.show);

  const kpiValue = (key: (typeof KPI_VIEWS)[number]["key"]) => {
    switch (key) {
      case "total":
        return kpis.total;
      case "active":
        return kpis.active;
      case "expiring":
        return kpis.expiring;
      case "expired":
        return kpis.expired;
      case "inactive":
        return kpis.inactive;
    }
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {KPI_VIEWS.map((kpi) => {
          const selected = view === kpi.view;
          return (
            <button
              key={kpi.key}
              type="button"
              onClick={() => onViewChange(kpi.view)}
              className={cn(
                "rounded-2xl border bg-card/40 px-4 py-3.5 text-left transition-colors min-h-[88px]",
                kpi.accent,
                selected
                  ? "ring-1 ring-orange-500/50 bg-orange-500/5"
                  : "hover:bg-white/[0.03]"
              )}
            >
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                {tinbox(`kpis.${kpi.key}`)}
              </p>
              <p className="mt-2 text-2xl font-black tabular-nums text-foreground">
                {kpiValue(kpi.key)}
              </p>
            </button>
          );
        })}
      </div>

      {/* Prioridades de hoy */}
      {priorityItems.length > 0 ? (
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-4 space-y-2.5">
          <h2 className="text-sm font-bold text-amber-200">
            {tinbox("priorities.title")}
          </h2>
          <ul className="space-y-2">
            {priorityItems.map((item) => {
              const selected = view === item.view;
              return (
              <li key={item.text}>
                <button
                  type="button"
                  onClick={() => onViewChange(item.view)}
                  className={cn(
                    "text-sm transition-colors text-left w-full rounded-lg px-2 py-1.5 -mx-2",
                    selected
                      ? "bg-amber-500/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="text-amber-400/90 mr-1.5" aria-hidden>
                    ⚠
                  </span>
                  {item.text}
                </button>
              </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Search + create */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={onSearchSubmit} className="flex gap-2 w-full sm:max-w-md">
          <Input
            placeholder={tinbox("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-11 text-base"
            aria-label={tinbox("searchPlaceholder")}
          />
          <Button type="submit" variant="secondary" className="min-h-11 shrink-0">
            {tc("search")}
          </Button>
        </form>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setError(null);
          }}
        >
          <DialogTrigger asChild>
            <Button className="min-h-11">{t("createUser")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("createUser")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{tinbox("fields.name")}</Label>
                <Input
                  value={form.nombre}
                  onChange={(e) =>
                    setForm({ ...form, nombre: e.target.value })
                  }
                  className="min-h-11 text-base"
                />
              </div>
              <div>
                <Label>{tinbox("fields.email")}</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  className="min-h-11 text-base"
                />
              </div>
              <div>
                <Label>{tinbox("fields.password")}</Label>
                <PasswordInput
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  className="min-h-11 text-base"
                />
              </div>
              <div>
                <Label>{tauth("phone")}</Label>
                <Input
                  value={form.telefono}
                  onChange={(e) =>
                    setForm({ ...form, telefono: e.target.value })
                  }
                  className="min-h-11 text-base"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button
                onClick={createUser}
                disabled={creating}
                className="w-full min-h-11"
              >
                {creating ? tc("loading") : t("createUser")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {(view !== "all" || search) && (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>
            {tinbox("showingCount", { count: filtered.length })}
            {isPending ? ` · ${tc("loading")}` : null}
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-11 text-orange-400 hover:text-orange-300 font-medium"
          >
            {tinbox("clearFilters")}
          </button>
        </div>
      )}

      {/* Desktop table */}
      <div className="rounded-2xl border border-white/5 overflow-hidden hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40">
            <tr>
              <th className="text-left p-4 font-semibold text-muted-foreground">
                {tinbox("columns.name")}
              </th>
              <th className="text-left p-4 font-semibold text-muted-foreground">
                {tinbox("columns.status")}
              </th>
              <th className="text-left p-4 font-semibold text-muted-foreground">
                {tinbox("columns.lastAttendance")}
              </th>
              <th className="text-left p-4 font-semibold text-muted-foreground">
                {tinbox("columns.membership")}
              </th>
              <th className="p-4 text-right font-semibold text-muted-foreground">
                {tinbox("columns.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const status = resolveAttentionCenterStatus(u);
              return (
                <tr
                  key={u.id}
                  className="border-t border-white/5 hover:bg-white/[0.02]"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9">
                        {u.foto_url ? (
                          <AvatarImage src={u.foto_url} alt="" />
                        ) : null}
                        <AvatarFallback>
                          {initials(u.nombre_completo)}
                        </AvatarFallback>
                      </Avatar>
                      <p className="font-medium truncate">{u.nombre_completo}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <StatusBadge status={status} labels={statusLabels} />
                  </td>
                  <td className="p-4 text-muted-foreground tabular-nums">
                    {attendanceLabel(u.daysSinceAttendance)}
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {membershipLabel(u)}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <WhatsAppReminderButton
                        phone={u.telefono}
                        nombre={u.nombre_completo}
                        fechaFin={u.fechaFin}
                        locale={locale}
                        type={u.whatsappType}
                        boxName={boxName}
                        athleteId={u.id}
                        compact
                      />
                      <Link href={profileHref(u.id)}>
                        <Button variant="ghost" size="sm" className="min-h-10">
                          {tinbox("openProfile")}
                        </Button>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="min-h-10 min-w-10"
                            aria-label={tinbox("moreActions")}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 p-2">
                          <DeleteSocioDialog
                            userId={u.user_id}
                            nombre={u.nombre_completo}
                          />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-10 px-4">
            {emptyMessage}
          </p>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((u) => {
          const status = resolveAttentionCenterStatus(u);
          return (
            <article
              key={u.id}
              className="rounded-2xl border border-white/10 bg-card/50 p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                <Avatar className="h-11 w-11">
                  {u.foto_url ? (
                    <AvatarImage src={u.foto_url} alt="" />
                  ) : null}
                  <AvatarFallback>{initials(u.nombre_completo)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="font-bold text-base truncate">
                    {u.nombre_completo}
                  </p>
                  <StatusBadge status={status} labels={statusLabels} />
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {attendanceLabel(u.daysSinceAttendance)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {membershipLabel(u)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <WhatsAppReminderButton
                  phone={u.telefono}
                  nombre={u.nombre_completo}
                  fechaFin={u.fechaFin}
                  locale={locale}
                  type={u.whatsappType}
                  boxName={boxName}
                  athleteId={u.id}
                  compact
                />
                <Link href={profileHref(u.id)} className="flex-1">
                  <Button variant="outline" className="w-full min-h-11">
                    {tinbox("openProfile")}
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="min-h-11 min-w-11"
                      aria-label={tinbox("moreActions")}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 p-2">
                    <DeleteSocioDialog
                      userId={u.user_id}
                      nombre={u.nombre_completo}
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </article>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}
