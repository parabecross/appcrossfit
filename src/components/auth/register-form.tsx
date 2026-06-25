"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import {
  uploadAvatarForUser,
  uploadAvatarViaApi,
} from "@/lib/avatars/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { APP_CONFIG } from "@/lib/config/app-config";

export function RegisterForm() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({
    email: "",
    password: "",
    nombre: "",
    telefono: "",
    bio: "",
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setWarning(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          nombre_completo: form.nombre,
          telefono: form.telefono,
          bio: form.bio,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user && photo) {
      const result = data.session
        ? await uploadAvatarForUser(supabase, data.user.id, photo)
        : await uploadAvatarViaApi(data.user.id, photo);

      if (result.error) {
        setWarning(t("photoUploadFailed"));
      }
    }

    if (data.session) {
      router.push("/mis-reservas");
    } else {
      router.push("/login");
    }

    setLoading(false);
  };

  return (
    <Card className="w-full max-w-md glow-primary">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2">
          <LanguageSwitcher />
        </div>
        <CardTitle className="text-2xl font-black uppercase tracking-wide brand-text">
          {APP_CONFIG.BRAND_NAME}
        </CardTitle>
        <CardDescription>{t("registerSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">{t("fullName")}</Label>
            <Input
              id="nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <PasswordInput
              id="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefono">{t("phone")}</Label>
            <Input
              id="telefono"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">{t("bio")}</Label>
            <Textarea
              id="bio"
              placeholder={t("bioPlaceholder")}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="photo">{t("photo")}</Label>
            <Input
              id="photo"
              type="file"
              accept="image/*"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {warning && <p className="text-sm text-amber-400">{warning}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? tc("loading") : t("register")}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t("hasAccount")}{" "}
          <Link href="/login" className="text-primary hover:underline">
            {t("login")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
