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
import type { AtletaPerfilDeportivo, Profile } from "@/types/database";

export function ProfileForm({
  profile,
  variant = "default",
  subtitle,
  perfilDeportivo = null,
}: {
  profile: Profile;
  variant?: "default" | "coach";
  subtitle?: string;
  perfilDeportivo?: AtletaPerfilDeportivo | null;
}) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const ts = useTranslations("socio");
  const ta = useTranslations("admin");
  const tsp = useTranslations("progress.sportsProfile");
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({
    nombre_completo: profile.nombre_completo,
    telefono: profile.telefono ?? "",
    bio: profile.bio ?? "",
  });
  const [sportsForm, setSportsForm] = useState({
    peso_corporal_kg: perfilDeportivo?.peso_corporal_kg?.toString() ?? "",
    estatura_cm: perfilDeportivo?.estatura_cm?.toString() ?? "",
    anos_entrenando: perfilDeportivo?.anos_entrenando?.toString() ?? "",
    modalidad_favorita: perfilDeportivo?.modalidad_favorita ?? "",
    notas: perfilDeportivo?.notas ?? "",
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

    if (variant === "default") {
      const { error: sportsError } = await supabase
        .from("atleta_perfil_deportivo")
        .upsert(
          {
            usuario_id: profile.id,
            peso_corporal_kg: sportsForm.peso_corporal_kg
              ? parseFloat(sportsForm.peso_corporal_kg)
              : null,
            estatura_cm: sportsForm.estatura_cm
              ? parseInt(sportsForm.estatura_cm, 10)
              : null,
            anos_entrenando: sportsForm.anos_entrenando
              ? parseInt(sportsForm.anos_entrenando, 10)
              : null,
            modalidad_favorita:
              sportsForm.modalidad_favorita.trim() || null,
            notas: sportsForm.notas.trim() || null,
          },
          { onConflict: "usuario_id" }
        );

      if (sportsError) {
        setError(sportsError.message);
        setLoading(false);
        return;
      }
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

        {variant === "default" && (
          <>
            <div className="border-t border-white/10 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-400/90">
                {tsp("label")}
              </p>
              <p className="text-sm font-semibold mt-1">{tsp("title")}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{tsp("weight")}</Label>
                <Input
                  className="h-12 rounded-xl"
                  type="number"
                  inputMode="decimal"
                  placeholder="75"
                  value={sportsForm.peso_corporal_kg}
                  onChange={(e) =>
                    setSportsForm({
                      ...sportsForm,
                      peso_corporal_kg: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>{tsp("height")}</Label>
                <Input
                  className="h-12 rounded-xl"
                  type="number"
                  inputMode="numeric"
                  placeholder="175"
                  value={sportsForm.estatura_cm}
                  onChange={(e) =>
                    setSportsForm({
                      ...sportsForm,
                      estatura_cm: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>{tsp("yearsTraining")}</Label>
                <Input
                  className="h-12 rounded-xl"
                  type="number"
                  inputMode="numeric"
                  placeholder="3"
                  value={sportsForm.anos_entrenando}
                  onChange={(e) =>
                    setSportsForm({
                      ...sportsForm,
                      anos_entrenando: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>{tsp("favoriteModality")}</Label>
                <Input
                  className="h-12 rounded-xl"
                  placeholder={tsp("favoriteModalityPlaceholder")}
                  value={sportsForm.modalidad_favorita}
                  onChange={(e) =>
                    setSportsForm({
                      ...sportsForm,
                      modalidad_favorita: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div>
              <Label>{tsp("notes")}</Label>
              <Textarea
                className="rounded-xl min-h-[80px]"
                rows={2}
                placeholder={tsp("notesPlaceholder")}
                value={sportsForm.notas}
                onChange={(e) =>
                  setSportsForm({ ...sportsForm, notas: e.target.value })
                }
              />
            </div>
          </>
        )}

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
