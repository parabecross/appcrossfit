"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
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
import { formatDate } from "@/lib/utils";
import {
  getSocioDisplayStatus,
  socioDisplayStatusBadgeVariant,
  syncMembresiaEstadoLocal,
  type SocioDisplayStatus,
} from "@/lib/membresias/helpers";
import type { Profile, Membresia, Plan } from "@/types/database";
import { useRouter } from "@/i18n/routing";
import { DeleteSocioDialog } from "@/components/admin/delete-socio-dialog";

interface UserRow extends Profile {
  membresia: (Membresia & { plan: Plan | null }) | null;
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

export function UsuariosTable({
  users,
  locale,
  gymTimezone,
}: {
  users: UserRow[];
  locale: string;
  gymTimezone?: string;
}) {
  const t = useTranslations("admin");
  const ts = useTranslations("accountStatus");
  const tauth = useTranslations("auth");
  const tc = useTranslations("common");
  const tm = useTranslations("membership.status");
  const tmem = useTranslations("membership");
  const [search, setSearch] = useState("");
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

  const filtered = users.filter(
    (u) =>
      u.nombre_completo.toLowerCase().includes(search.toLowerCase()) ||
      u.telefono?.includes(search)
  );

  const createUser = async () => {
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/crear-usuario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Error");
      setCreating(false);
      return;
    }
    router.refresh();
    setCreating(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <Input
          placeholder={tc("search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-sm"
        />
        <Dialog>
          <DialogTrigger asChild>
            <Button>{t("createUser")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("createUser")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nombre</Label>
                <Input
                  value={form.nombre}
                  onChange={(e) =>
                    setForm({ ...form, nombre: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Password</Label>
                <PasswordInput
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{tauth("phone")}</Label>
                <Input
                  value={form.telefono}
                  onChange={(e) =>
                    setForm({ ...form, telefono: e.target.value })
                  }
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button onClick={createUser} disabled={creating} className="w-full">
                {creating ? tc("loading") : t("createUser")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-white/5 overflow-hidden hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr>
              <th className="text-left p-3 font-semibold">Nombre</th>
              <th className="text-left p-3 font-semibold hidden md:table-cell">
                Teléfono
              </th>
              <th className="text-left p-3 font-semibold">Estado</th>
              <th className="text-left p-3 font-semibold hidden lg:table-cell">
                Membresía
              </th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const status = getSocioDisplayStatus(u, u.membresia, gymTimezone);
              const membresiaEstado = u.membresia
                ? syncMembresiaEstadoLocal(
                    u.membresia.fecha_fin,
                    u.membresia.estado,
                    gymTimezone
                  )
                : null;

              return (
              <tr
                key={u.id}
                className="border-t border-white/5 hover:bg-white/[0.02]"
              >
                <td className="p-3 font-medium">{u.nombre_completo}</td>
                <td className="p-3 hidden md:table-cell text-muted-foreground">
                  {u.telefono ?? "—"}
                </td>
                <td className="p-3">
                  <Badge variant={socioDisplayStatusBadgeVariant(status)}>
                    {socioStatusLabel(status, ts, tm, tmem, t)}
                  </Badge>
                </td>
                <td className="p-3 hidden lg:table-cell">
                  {u.membresia ? (
                    <span className="text-muted-foreground">
                      {u.membresia.plan?.nombre} ·{" "}
                      {membresiaEstado ? tm(membresiaEstado) : "—"} ·{" "}
                      {formatDate(u.membresia.fecha_fin, locale)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <DeleteSocioDialog
                      userId={u.user_id}
                      nombre={u.nombre_completo}
                    />
                    <Link href={`/admin/usuarios/${u.id}`}>
                      <Button variant="ghost" size="sm">
                        →
                      </Button>
                    </Link>
                  </div>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {filtered.map((u) => {
          const status = getSocioDisplayStatus(u, u.membresia, gymTimezone);
          const membresiaEstado = u.membresia
            ? syncMembresiaEstadoLocal(
                u.membresia.fecha_fin,
                u.membresia.estado,
                gymTimezone
              )
            : null;

          return (
          <div
            key={u.id}
            className="rounded-2xl border border-white/10 bg-card/50 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-base truncate">{u.nombre_completo}</p>
                {u.telefono && (
                  <p className="text-sm text-muted-foreground mt-0.5">{u.telefono}</p>
                )}
              </div>
              <Badge variant={socioDisplayStatusBadgeVariant(status)}>
                {socioStatusLabel(status, ts, tm, tmem, t)}
              </Badge>
            </div>
            {u.membresia && (
              <p className="text-sm text-muted-foreground">
                {u.membresia.plan?.nombre} ·{" "}
                {membresiaEstado ? tm(membresiaEstado) : "—"} ·{" "}
                {formatDate(u.membresia.fecha_fin, locale)}
              </p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <Link href={`/admin/usuarios/${u.id}`} className="flex-1">
                <Button variant="outline" className="w-full">
                  Ver detalle
                </Button>
              </Link>
              <DeleteSocioDialog userId={u.user_id} nombre={u.nombre_completo} />
            </div>
          </div>
        );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">{tc("noData")}</p>
        )}
      </div>
    </div>
  );
}
