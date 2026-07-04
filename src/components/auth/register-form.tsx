"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import {
  uploadAvatarForUser,
  uploadAvatarViaApi,
} from "@/lib/avatars/upload";
import { slugifyBoxName } from "@/lib/box/slug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { PhotoUploadInput } from "@/components/auth/photo-upload-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { AthronLogo } from "@/components/brand/athron-logo";
import { APP_CONFIG } from "@/lib/config/app-config";
import { cn } from "@/lib/utils";

type AccountType = "atleta" | "gym";

interface BoxOption {
  id: string;
  name: string;
  slug: string;
}

const GYM_TIMEZONES = [
  { value: "America/Mexico_City", label: "Ciudad de México (CST)" },
  { value: "America/Bogota", label: "Bogotá (COT)" },
  { value: "America/Lima", label: "Lima (PET)" },
  { value: "America/Santiago", label: "Santiago (CLT)" },
  { value: "America/Buenos_Aires", label: "Buenos Aires (ART)" },
  { value: "America/New_York", label: "Nueva York (EST)" },
  { value: "Europe/Madrid", label: "Madrid (CET)" },
];

function postRegisterPath(accountType: AccountType): string {
  if (accountType === "gym") return "/admin/dashboard";
  return "/mis-reservas";
}

export function RegisterForm() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>("atleta");
  const [boxes, setBoxes] = useState<BoxOption[]>([]);
  const [boxesLoading, setBoxesLoading] = useState(true);
  const [form, setForm] = useState({
    email: "",
    password: "",
    nombre: "",
    telefono: "",
    bio: "",
    boxId: "",
    boxName: "",
    boxTimezone: APP_CONFIG.GYM_TIMEZONE as string,
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/boxes/disponibles");
        const json = await res.json();
        if (!cancelled && res.ok) {
          setBoxes(json.boxes ?? []);
        }
      } catch {
        if (!cancelled) setBoxes([]);
      } finally {
        if (!cancelled) setBoxesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setWarning(null);

    if (accountType !== "gym" && !form.boxId) {
      setError(t("selectBoxRequired"));
      setLoading(false);
      return;
    }

    if (accountType === "gym" && !form.boxName.trim()) {
      setError(t("boxNameRequired"));
      setLoading(false);
      return;
    }

    const metadata: Record<string, string> = {
      nombre_completo: form.nombre,
      telefono: form.telefono,
      bio: form.bio,
    };

    if (accountType === "atleta") {
      metadata.box_id = form.boxId;
    } else {
      metadata.rol = "box_admin";
      metadata.box_name = form.boxName.trim();
      metadata.box_slug = slugifyBoxName(form.boxName);
      metadata.box_timezone = form.boxTimezone;
    }

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: metadata },
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
      router.push(postRegisterPath(accountType));
    } else {
      router.push("/login");
    }
  };

  const accountTypes: { id: AccountType; label: string }[] = [
    { id: "atleta", label: t("accountTypeAtleta") },
    { id: "gym", label: t("accountTypeGym") },
  ];

  return (
    <Card className="w-full max-w-md glow-primary">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3">
          <AthronLogo className="max-w-[240px]" />
        </div>
        <div className="mx-auto mb-2">
          <LanguageSwitcher />
        </div>
        <CardDescription>{t("registerSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("accountType")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {accountTypes.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAccountType(id)}
                  className={cn(
                    "rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors sm:text-sm",
                    accountType === id
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-input bg-secondary/30 text-muted-foreground hover:border-white/20"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {accountType !== "gym" ? (
            <div className="space-y-2">
              <Label htmlFor="box">{t("selectBox")}</Label>
              <Select
                value={form.boxId}
                onValueChange={(value) => setForm({ ...form, boxId: value })}
                disabled={boxesLoading || boxes.length === 0}
              >
                <SelectTrigger id="box">
                  <SelectValue
                    placeholder={
                      boxesLoading
                        ? tc("loading")
                        : boxes.length === 0
                          ? t("noBoxesAvailable")
                          : t("selectBoxPlaceholder")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {boxes.map((box) => (
                    <SelectItem key={box.id} value={box.id}>
                      {box.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="boxName">{t("boxName")}</Label>
                <Input
                  id="boxName"
                  placeholder={t("boxNamePlaceholder")}
                  value={form.boxName}
                  onChange={(e) => setForm({ ...form, boxName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="boxTimezone">{t("boxTimezone")}</Label>
                <Select
                  value={form.boxTimezone}
                  onValueChange={(value) =>
                    setForm({ ...form, boxTimezone: value })
                  }
                >
                  <SelectTrigger id="boxTimezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GYM_TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

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
          {accountType === "atleta" && (
            <div className="space-y-2">
              <Label htmlFor="bio">{t("bio")}</Label>
              <Textarea
                id="bio"
                placeholder={t("bioPlaceholder")}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="photo">{t("photo")}</Label>
            <PhotoUploadInput id="photo" onChange={setPhoto} />
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
