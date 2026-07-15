"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate, formatTime, cn } from "@/lib/utils";
import {
  socioDisplayStatusBadgeVariant,
  syncMembresiaEstadoLocal,
  type SocioDisplayStatus,
} from "@/lib/membresias/helpers";
import type { AthleteInboxRow } from "@/lib/queries/admin-usuarios-inbox";
import {
  USUARIOS_VIEW_VALUES,
  buildUsuariosInboxHref,
  encodeUsuariosReturnParam,
  filterAthleteInboxRows,
  type UsuariosInboxFilters,
  type UsuariosInboxView,
} from "@/lib/admin/usuarios-filters";
import { DeleteSocioDialog } from "@/components/admin/delete-socio-dialog";
import { WhatsAppReminderButton } from "@/components/admin/whatsapp-reminder-button";

/** Relative days since an ISO timestamp (for inbox badges). */
function daysAgoLabel(
  iso: string | null,
  formatDays: (days: number) => string
): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  const days = Math.max(0, Math.floor(ms / 86_400_000));
  return formatDays(days);
}

function FollowUpBadges({
  row,
  labels,
}: {
  row: AthleteInboxRow;
  labels: {
    neverContacted: string;
    overdue: string;
    today: string;
    scheduled: string;
    resolvedRecently: string;
  };
}) {
  const badges: { key: string; className: string; label: string }[] = [];
  if (row.neverContacted) {
    badges.push({
      key: "never",
      className: "bg-white/10 text-muted-foreground",
      label: labels.neverContacted,
    });
  } else if (row.followUpStatus === "overdue") {
    badges.push({
      key: "overdue",
      className: "bg-red-500/20 text-red-400",
      label: labels.overdue,
    });
  } else if (row.followUpStatus === "today") {
    badges.push({
      key: "today",
      className: "bg-orange-500/20 text-orange-400",
      label: labels.today,
    });
  } else if (row.followUpStatus === "scheduled") {
    badges.push({
      key: "scheduled",
      className: "bg-sky-500/15 text-sky-300",
      label: labels.scheduled,
    });
  }
  if (row.resolvedRecently) {
    badges.push({
      key: "resolved",
      className: "bg-green-500/15 text-green-400",
      label: labels.resolvedRecently,
    });
  }
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {badges.map((b) => (
        <span
          key={b.key}
          className={cn(
            "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
            b.className
          )}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

function initials(nombre: string) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function socioStatusLabel(
  status: SocioDisplayStatus,
  ts: (key: string) => string,
  tm: (key: string) => string,
  tmem: (key: string) => string,
  tadmin: (key: string) => string
): string {
  switch (status) {
    case "pendiente_pago":
      return ts("pendiente_pago");
    case "activo":
      return ts("activo");
    case "vencida":
      return tm("vencida");
    case "sin_membresia":
      return tmem("noMembership");
    case "por_vencer":
      return tadmin("socioStatusPorVencer");
  }
}

function AttentionBadge({
  level,
  labels,
}: {
  level: AthleteInboxRow["level"];
  labels: { high: string; medium: string; low: string };
}) {
  const text =
    level === "high"
      ? labels.high
      : level === "medium"
        ? labels.medium
        : labels.low;
  return (
    <span
      className={cn(
        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0",
        level === "high" && "bg-red-500/20 text-red-400",
        level === "medium" && "bg-orange-500/20 text-orange-400",
        level === "low" && "bg-white/10 text-muted-foreground"
      )}
    >
      {text}
    </span>
  );
}

const VIEW_CHIPS: UsuariosInboxView[] = [...USUARIOS_VIEW_VALUES];

export function UsuariosTable({
  rows,
  locale,
  gymTimezone,
  boxName,
  initialFilters,
  viewCounts,
}: {
  rows: AthleteInboxRow[];
  locale: string;
  gymTimezone?: string;
  boxName: string;
  initialFilters: UsuariosInboxFilters;
  /** Box totals from the current inbox snapshot (not narrowed by search). */
  viewCounts: Record<UsuariosInboxView, number>;
}) {
  const t = useTranslations("admin");
  const tinbox = useTranslations("admin.athletesInbox");
  const ts = useTranslations("accountStatus");
  const tauth = useTranslations("auth");
  const tc = useTranslations("common");
  const tm = useTranslations("membership.status");
  const tmem = useTranslations("membership");
  const td = useTranslations("adminDashboard.attention");
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

  const filtered = useMemo(
    () =>
      filterAthleteInboxRows(rows, {
        view,
        q: search,
      }),
    [rows, view, search]
  );

  const syncUrl = (next: UsuariosInboxFilters) => {
    startTransition(() => {
      router.replace(buildUsuariosInboxHref(next));
    });
  };

  const onViewChange = (nextView: UsuariosInboxView) => {
    setView(nextView);
    syncUrl({ view: nextView, q: search });
  };

  const onSearchChange = (value: string) => {
    setSearch(value);
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

  const reasonLabel = (key: string) => {
    try {
      return td(`reasons.${key}` as never);
    } catch {
      return key;
    }
  };

  const emptyMessage =
    view !== "all"
      ? tinbox(`empty.${view}` as never)
      : search
        ? tinbox("empty.search")
        : tinbox("empty.all");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={onSearchSubmit} className="flex gap-2 w-full sm:max-w-md">
          <Input
            placeholder={tinbox("searchPlaceholder")}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
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

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {VIEW_CHIPS.map((chip) => {
          const count = viewCounts[chip];
          return (
            <button
              key={chip}
              type="button"
              onClick={() => onViewChange(chip)}
              className={cn(
                "min-h-11 shrink-0 rounded-full px-3 text-xs font-semibold border transition-colors inline-flex items-center gap-1.5",
                view === chip
                  ? "bg-orange-500/15 border-orange-500/40 text-orange-300"
                  : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20"
              )}
            >
              <span>{tinbox(`views.${chip}`)}</span>
              <span className="tabular-nums opacity-80">({count})</span>
            </button>
          );
        })}
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
      <div className="rounded-xl border border-white/5 overflow-hidden hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr>
              <th className="text-left p-3 font-semibold">{tinbox("columns.athlete")}</th>
              <th className="text-left p-3 font-semibold">{tinbox("columns.attention")}</th>
              <th className="text-left p-3 font-semibold">{tinbox("columns.membership")}</th>
              <th className="text-left p-3 font-semibold hidden lg:table-cell">
                {tinbox("columns.attendance")}
              </th>
              <th className="text-left p-3 font-semibold hidden xl:table-cell">
                {tinbox("columns.nextClass")}
              </th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const membresiaEstado = u.membresia
                ? syncMembresiaEstadoLocal(
                    u.membresia.fecha_fin,
                    u.membresia.estado,
                    gymTimezone
                  )
                : null;
              const reasons = u.reasons
                .filter((r) => r !== "new_athlete")
                .slice(0, 2);

              return (
                <tr
                  key={u.id}
                  className="border-t border-white/5 hover:bg-white/[0.02]"
                >
                  <td className="p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9">
                        {u.foto_url ? (
                          <AvatarImage src={u.foto_url} alt="" />
                        ) : null}
                        <AvatarFallback>
                          {initials(u.nombre_completo)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {u.nombre_completo}
                        </p>
                        {reasons.length > 0 ? (
                          <p className="text-xs text-muted-foreground truncate">
                            {reasons.map(reasonLabel).join(" · ")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <AttentionBadge
                      level={u.level}
                      labels={{
                        high: td("levelHigh"),
                        medium: td("levelMedium"),
                        low: td("levelLow"),
                      }}
                    />
                    <FollowUpBadges
                      row={u}
                      labels={{
                        neverContacted: tinbox("followUp.badgeNeverContacted"),
                        overdue: tinbox("followUp.badgeOverdue"),
                        today: tinbox("followUp.badgeToday"),
                        scheduled: tinbox("followUp.badgeScheduled"),
                        resolvedRecently: tinbox(
                          "followUp.badgeResolvedRecently"
                        ),
                      }}
                    />
                    {u.lastContactAt ? (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {tinbox("followUp.lastContact")}:{" "}
                        {daysAgoLabel(u.lastContactAt, (days) =>
                          tinbox("followUp.contactedDaysAgo", { days })
                        ) ?? formatDate(u.lastContactAt.slice(0, 10), locale)}
                      </p>
                    ) : null}
                    {u.followUpAt ? (
                      <p className="text-[11px] text-muted-foreground">
                        {tinbox("followUp.next")}:{" "}
                        {formatDate(u.followUpAt.slice(0, 10), locale)}
                      </p>
                    ) : null}
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={socioDisplayStatusBadgeVariant(u.membershipStatus)}
                    >
                      {socioStatusLabel(u.membershipStatus, ts, tm, tmem, t)}
                    </Badge>
                    {u.membresia ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        {u.membresia.plan?.nombre} ·{" "}
                        {membresiaEstado ? tm(membresiaEstado) : "—"} ·{" "}
                        {formatDate(u.membresia.fecha_fin, locale)}
                      </p>
                    ) : null}
                  </td>
                  <td className="p-3 hidden lg:table-cell text-muted-foreground tabular-nums">
                    {u.daysSinceAttendance != null
                      ? tinbox("daysSince", { days: u.daysSinceAttendance })
                      : tinbox("noAttendance")}
                  </td>
                  <td className="p-3 hidden xl:table-cell text-muted-foreground">
                    {u.nextReservation
                      ? `${formatDate(u.nextReservation.fecha, locale)} · ${formatTime(u.nextReservation.hora)}`
                      : "—"}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <WhatsAppReminderButton
                        phone={u.telefono}
                        nombre={u.nombre_completo}
                        fechaFin={u.fechaFin}
                        locale={locale}
                        type={u.whatsappType}
                        boxName={boxName}
                        athleteId={u.id}
                      />
                      <DeleteSocioDialog
                        userId={u.user_id}
                        nombre={u.nombre_completo}
                      />
                      <Link
                        href={`/admin/usuarios/${u.id}${returnParam ? `?ret=${encodeURIComponent(returnParam)}` : ""}`}
                      >
                        <Button variant="ghost" size="sm" className="min-h-11">
                          {tinbox("openProfile")}
                        </Button>
                      </Link>
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
          const reasons = u.reasons
            .filter((r) => r !== "new_athlete")
            .slice(0, 2);
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
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-base truncate">
                      {u.nombre_completo}
                    </p>
                    <AttentionBadge
                      level={u.level}
                      labels={{
                        high: td("levelHigh"),
                        medium: td("levelMedium"),
                        low: td("levelLow"),
                      }}
                    />
                  </div>
                  <FollowUpBadges
                    row={u}
                    labels={{
                      neverContacted: tinbox("followUp.badgeNeverContacted"),
                      overdue: tinbox("followUp.badgeOverdue"),
                      today: tinbox("followUp.badgeToday"),
                      scheduled: tinbox("followUp.badgeScheduled"),
                      resolvedRecently: tinbox(
                        "followUp.badgeResolvedRecently"
                      ),
                    }}
                  />
                  <Badge
                    variant={socioDisplayStatusBadgeVariant(u.membershipStatus)}
                  >
                    {socioStatusLabel(u.membershipStatus, ts, tm, tmem, t)}
                  </Badge>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {u.daysSinceAttendance != null
                      ? tinbox("daysSince", { days: u.daysSinceAttendance })
                      : tinbox("noAttendance")}
                  </p>
                  {u.lastContactAt ? (
                    <p className="text-[11px] text-muted-foreground">
                      {tinbox("followUp.lastContact")}:{" "}
                      {daysAgoLabel(u.lastContactAt, (days) =>
                        tinbox("followUp.contactedDaysAgo", { days })
                      ) ?? formatDate(u.lastContactAt.slice(0, 10), locale)}
                    </p>
                  ) : null}
                  {reasons.length > 0 ? (
                    <ul className="space-y-0.5">
                      {reasons.map((r) => (
                        <li key={r} className="text-xs text-muted-foreground">
                          {reasonLabel(r)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Link
                  href={`/admin/usuarios/${u.id}${returnParam ? `?ret=${encodeURIComponent(returnParam)}` : ""}`}
                  className="flex-1"
                >
                  <Button variant="outline" className="w-full min-h-11">
                    {tinbox("openProfile")}
                  </Button>
                </Link>
                <WhatsAppReminderButton
                  phone={u.telefono}
                  nombre={u.nombre_completo}
                  fechaFin={u.fechaFin}
                  locale={locale}
                  type={u.whatsappType}
                  boxName={boxName}
                  athleteId={u.id}
                />
                <DeleteSocioDialog
                  userId={u.user_id}
                  nombre={u.nombre_completo}
                />
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
