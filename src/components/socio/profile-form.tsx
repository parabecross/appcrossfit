"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatarForUser } from "@/lib/avatars/upload";
import { PhotoUploadInput } from "@/components/auth/photo-upload-input";
import { useRouter } from "@/i18n/routing";
import { SocioPageHeader } from "@/components/socio/socio-page-header";
import type { Profile } from "@/types/database";

export function ProfileForm({
  profile,
  variant = "default",
  subtitle,
}: {
  profile: Profile;
  variant?: "default" | "coach";
  subtitle?: string;
}) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const ts = useTranslations("socio");
  const ta = useTranslations("admin");
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({
    nombre_completo: profile.nombre_completo,
    telefono: profile.telefono ?? "",
    bio: profile.bio ?? "",
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(profile.foto_url);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handlePhotoChange = (file: File | null) => {
    setPhoto(file);
    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const save = async () => {
    setLoading(true);
    setError(null);
    setSaved(false);
    let foto_url = profile.foto_url;

    if (photo) {
      const result = await uploadAvatarForUser(
        supabase,
        profile.user_id,
        photo
      );
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      foto_url = result.url;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ ...form, foto_url })
      .eq("id", profile.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSaved(true);
    router.refresh();
    setLoading(false);
  };

  const pageSubtitle =
    subtitle ?? (variant === "default" ? ts("profileSubtitle") : undefined);

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <SocioPageHeader
        title={variant === "coach" ? tn("profile") : tn("profile")}
        subtitle={pageSubtitle}
      />

      <div className="flex flex-col items-center py-2">
        <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-primary/30 ring-4 ring-primary/10">
          {photoPreview ? (
            <Image
              src={photoPreview}
              alt={form.nombre_completo}
              fill
              className="object-cover"
              sizes="96px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary">
              <User className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
        </div>
        <p className="font-bold text-lg mt-3">{form.nombre_completo}</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-card/50 p-4 md:p-6 space-y-4">
        <div>
          <Label htmlFor="profile-photo">{t("photo")}</Label>
          <PhotoUploadInput
            id="profile-photo"
            initialPreview={profile.foto_url}
            onChange={handlePhotoChange}
          />
        </div>
        <div>
          <Label>{t("fullName")}</Label>
          <Input
            className="h-12 rounded-xl"
            value={form.nombre_completo}
            onChange={(e) =>
              setForm({ ...form, nombre_completo: e.target.value })
            }
          />
        </div>
        <div>
          <Label>{t("phone")}</Label>
          <Input
            className="h-12 rounded-xl"
            type="tel"
            value={form.telefono}
            onChange={(e) =>
              setForm({ ...form, telefono: e.target.value })
            }
          />
        </div>
        <div>
          <Label>{t("bio")}</Label>
          <Textarea
            className="rounded-xl min-h-[100px]"
            value={form.bio}
            placeholder={
              variant === "coach"
                ? ta("coachBioPlaceholder")
                : t("bioPlaceholder")
            }
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={variant === "coach" ? 4 : 3}
          />
          {variant === "coach" && (
            <p className="text-xs text-muted-foreground mt-1">
              {ta("coachBioHint")}
            </p>
          )}
        </div>

        <div className="hidden md:block space-y-2">
          <Button onClick={save} disabled={loading} className="w-full h-12 rounded-xl">
            {loading ? tc("loading") : tc("save")}
          </Button>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {saved && (
            <p className="text-sm text-green-400 text-center">{tc("success")}</p>
          )}
        </div>
      </div>

      <div className="md:hidden fixed bottom-20 left-0 right-0 z-30 px-4 safe-bottom">
        <div className="rounded-2xl border border-white/10 bg-card/95 backdrop-blur-md p-3 shadow-xl">
          <Button
            onClick={save}
            disabled={loading}
            className="w-full h-12 rounded-xl font-semibold"
          >
            {loading ? tc("loading") : tc("save")}
          </Button>
          {error && (
            <p className="text-sm text-red-400 text-center mt-2">{error}</p>
          )}
          {saved && (
            <p className="text-sm text-green-400 text-center mt-2">
              {tc("success")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
