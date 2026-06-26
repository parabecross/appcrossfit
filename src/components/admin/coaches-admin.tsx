"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, KeyRound } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import type { CoachWithEmail } from "@/lib/queries/coaches";
import { useRouter } from "@/i18n/routing";

interface Credentials {
  email: string;
  password: string;
  nombre: string;
}

export function CoachesAdmin({
  coaches,
}: {
  coaches: CoachWithEmail[];
  locale?: string;
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const ta = useTranslations("auth");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [credsOpen, setCredsOpen] = useState(false);
  const [createdCredsOpen, setCreatedCredsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CoachWithEmail | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    nombre: "",
    telefono: "",
  });
  const [editForm, setEditForm] = useState({
    nombre_completo: "",
    email: "",
    telefono: "",
  });
  const [newPassword, setNewPassword] = useState("");
  const router = useRouter();

  const filtered = coaches.filter(
    (c) =>
      c.nombre_completo.toLowerCase().includes(search.toLowerCase()) ||
      c.telefono?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (coach: CoachWithEmail) => {
    setSelected(coach);
    setEditForm({
      nombre_completo: coach.nombre_completo,
      email: coach.email ?? "",
      telefono: coach.telefono ?? "",
    });
    setError(null);
    setEditOpen(true);
  };

  const openCredentials = (coach: CoachWithEmail) => {
    setSelected(coach);
    setNewPassword("");
    setCredentials(null);
    setError(null);
    setCredsOpen(true);
  };

  const createCoach = async () => {
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/crear-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...createForm, rol: "coach" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? tc("error"));
        return;
      }
      setCredentials({
        email: createForm.email,
        password: createForm.password,
        nombre: createForm.nombre,
      });
      setCreateForm({ email: "", password: "", nombre: "", telefono: "" });
      setCreateOpen(false);
      setCreatedCredsOpen(true);
      router.refresh();
    } catch {
      setError(tc("error"));
    } finally {
      setCreating(false);
    }
  };

  const saveCoach = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/coach", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selected.user_id,
          ...editForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? tc("error"));
        return;
      }
      setEditOpen(false);
      router.refresh();
    } catch {
      setError(tc("error"));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!selected || !newPassword) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/coach/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selected.user_id,
          password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? tc("error"));
        return;
      }
      setCredentials({
        email: data.email ?? selected.email ?? "",
        password: data.password,
        nombre: selected.nombre_completo,
      });
    } catch {
      setError(tc("error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <Input
          placeholder={tc("search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>{t("createCoach")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("createCoach")}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{t("createCoachDesc")}</p>
            <div className="space-y-3">
              <div>
                <Label>{ta("fullName")}</Label>
                <Input
                  value={createForm.nombre}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, nombre: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{ta("email")}</Label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, email: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{ta("password")}</Label>
                <PasswordInput
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, password: e.target.value })
                  }
                  minLength={6}
                />
              </div>
              <div>
                <Label>{ta("phone")}</Label>
                <Input
                  value={createForm.telefono}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, telefono: e.target.value })
                  }
                />
              </div>
              {error && createOpen && (
                <p className="text-sm text-red-400">{error}</p>
              )}
              <Button
                onClick={createCoach}
                disabled={
                  creating ||
                  !createForm.nombre ||
                  !createForm.email ||
                  !createForm.password
                }
                className="w-full"
              >
                {creating ? tc("loading") : t("createCoach")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-white/5 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-secondary/50">
            <tr>
              <th className="text-left p-3 font-semibold">{ta("fullName")}</th>
              <th className="text-left p-3 font-semibold">{ta("email")}</th>
              <th className="text-left p-3 font-semibold hidden md:table-cell">
                {ta("phone")}
              </th>
              <th className="text-right p-3 font-semibold">{tc("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                  {tc("noData")}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-white/5 hover:bg-white/[0.02]"
                >
                  <td className="p-3 font-medium">{c.nombre_completo}</td>
                  <td className="p-3 text-muted-foreground">{c.email ?? "—"}</td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">
                    {c.telefono ?? "—"}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(c)}
                        title={tc("edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openCredentials(c)}
                        title={t("viewCredentials")}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Editar coach */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editCoach")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{ta("fullName")}</Label>
              <Input
                value={editForm.nombre_completo}
                onChange={(e) =>
                  setEditForm({ ...editForm, nombre_completo: e.target.value })
                }
              />
            </div>
            <div>
              <Label>{ta("email")}</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
              />
            </div>
            <div>
              <Label>{ta("phone")}</Label>
              <Input
                value={editForm.telefono}
                onChange={(e) =>
                  setEditForm({ ...editForm, telefono: e.target.value })
                }
              />
            </div>
            {error && editOpen && (
              <p className="text-sm text-red-400">{error}</p>
            )}
            <Button onClick={saveCoach} disabled={loading} className="w-full">
              {loading ? tc("loading") : tc("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credenciales existentes */}
      <Dialog open={credsOpen} onOpenChange={setCredsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("viewCredentials")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("passwordNotStored")}</p>
          <div className="space-y-3 rounded-lg bg-secondary/30 p-4">
            <div>
              <p className="text-xs text-muted-foreground">{ta("email")}</p>
              <p className="font-medium">{selected?.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("loginUser")}</p>
              <p className="font-medium">{selected?.email ?? "—"}</p>
            </div>
          </div>
          {credentials && (
            <div className="space-y-2 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
              <p className="text-sm font-semibold text-green-400">
                {t("newPasswordSet")}
              </p>
              <p className="text-sm">
                {ta("password")}:{" "}
                <span className="font-mono font-bold">{credentials.password}</span>
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label>{t("resetPassword")}</Label>
            <PasswordInput
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              placeholder={t("newPasswordPlaceholder")}
            />
          </div>
          {error && credsOpen && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          <Button
            onClick={resetPassword}
            disabled={loading || newPassword.length < 6}
            className="w-full"
          >
            {loading ? tc("loading") : t("resetPassword")}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Credenciales al crear */}
      <Dialog open={createdCredsOpen} onOpenChange={setCreatedCredsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("coachCreated")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("saveCredentials")}</p>
          {credentials && (
            <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/10 p-4">
              <div>
                <p className="text-xs text-muted-foreground">{ta("fullName")}</p>
                <p className="font-medium">{credentials.nombre}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("loginUser")}</p>
                <p className="font-mono font-medium">{credentials.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{ta("password")}</p>
                <p className="font-mono font-bold">{credentials.password}</p>
              </div>
            </div>
          )}
          <Button onClick={() => setCreatedCredsOpen(false)} className="w-full">
            {tc("confirm")}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
