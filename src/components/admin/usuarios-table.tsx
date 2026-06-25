"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import type { Profile, Membresia, Plan } from "@/types/database";
import { useRouter } from "@/i18n/routing";

interface UserRow extends Profile {
  membresia: (Membresia & { plan: Plan | null }) | null;
}

export function UsuariosTable({
  users,
  locale,
}: {
  users: UserRow[];
  locale: string;
}) {
  const t = useTranslations("admin");
  const ta = useTranslations("accountStatus");
  const tm = useTranslations("membership.status");
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
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
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
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input
                  value={form.telefono}
                  onChange={(e) =>
                    setForm({ ...form, telefono: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Rol</Label>
                <Select
                  value={form.rol}
                  onValueChange={(v) => setForm({ ...form, rol: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="socio">Socio</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button onClick={createUser} disabled={creating} className="w-full">
                {creating ? "..." : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-white/5 overflow-hidden">
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
            {filtered.map((u) => (
              <tr
                key={u.id}
                className="border-t border-white/5 hover:bg-white/[0.02]"
              >
                <td className="p-3 font-medium">{u.nombre_completo}</td>
                <td className="p-3 hidden md:table-cell text-muted-foreground">
                  {u.telefono ?? "—"}
                </td>
                <td className="p-3">
                  <Badge
                    variant={
                      u.estado_cuenta === "activo" ? "success" : "warning"
                    }
                  >
                    {ta(u.estado_cuenta)}
                  </Badge>
                </td>
                <td className="p-3 hidden lg:table-cell">
                  {u.membresia ? (
                    <span className="text-muted-foreground">
                      {u.membresia.plan?.nombre} ·{" "}
                      {tm(u.membresia.estado)} ·{" "}
                      {formatDate(u.membresia.fecha_fin, locale)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-3 text-right">
                  <Link href={`/admin/usuarios/${u.id}`}>
                    <Button variant="ghost" size="sm">
                      →
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
