"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatarForUser } from "@/lib/avatars/upload";
import { uploadBoxLogoViaApi } from "@/lib/box/upload-logo";
import { PhotoUploadInput } from "@/components/auth/photo-upload-input";
import { useRouter } from "@/i18n/routing";
import { SocioPageHeader } from "@/components/socio/socio-page-header";
import type { Profile } from "@/types/database";

export function ProfileForm({
  profile,
  email,
  variant = "default",
  subtitle,
  boxLogoUrl = null,
}: {
  profile: Profile;
  email?: string | null;
  variant?: "default" | "coach" | "box_owner";
  subtitle?: string;
  boxLogoUrl?: string | null;
}) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const ts = useTranslations("socio");
  const ta = useTranslations("admin");
  const router = useRouter();
  const supabase = createClient();
  const [emailDisplay, setEmailDisplay] = useState(email ?? "");
  const [form, setForm] = useState({
    nombre_completo: profile.nombre_completo,
    telefono: profile.telefono ?? "",
    bio: profile.bio ?? "",
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (email) {
      setEmailDisplay(email);
      return;
    }
    const client = createClient();
    client.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmailDisplay(user.email);
    });
  }, [email]);

  const handlePhotoChange = (file: File | null) => {
    setPhoto(file);
  };

  const isBoxOwner = variant === "box_owner";
  const isCoach = variant === "coach";
  const isAthlete = variant === "default";

  const save = async () => {
    setLoading(true);
    setError(null);
    setSaved(false);
    let foto_url = profile.foto_url;

    if (photo) {
      if (isBoxOwner) {
        const result = await uploadBoxLogoViaApi(photo);
        if (result.error) {
          setError(result.error);
          setLoading(false);
          return;
        }
      } else {
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
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(isBoxOwner ? form : { ...form, foto_url })
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
    subtitle ??
    (isAthlete ? ts("profileSubtitle") : undefined);

  const photoPreview = isBoxOwner ? boxLogoUrl : profile.foto_url;

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <SocioPageHeader
        title={tn("profile")}
        subtitle={pageSubtitle}
      />

      <div className="rounded-2xl border border-white/10 bg-card/50 p-4 md:p-6 space-y-4">
        <div>
          <Label htmlFor="profile-photo">
            {isBoxOwner ? ta("boxPhoto") : t("photo")}
          </Label>
          <PhotoUploadInput
            id="profile-photo"
            initialPreview={photoPreview}
            onChange={handlePhotoChange}
            copy={
              isBoxOwner
                ? {
                    placeholder: ta("boxPhotoPlaceholder"),
                    cropHint: ta("boxPhotoHint"),
                  }
                : undefined
            }
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
          <Label>{t("email")}</Label>
          <Input
            className="h-12 rounded-xl bg-white/5 text-muted-foreground"
            type="email"
            value={emailDisplay}
            readOnly
            autoComplete="email"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {ts("profileEmailHint")}
          </p>
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
          <Label>{isBoxOwner ? ta("boxBio") : t("bio")}</Label>
          <Textarea
            className="rounded-xl min-h-[100px]"
            value={form.bio}
            placeholder={
              isCoach
                ? ta("coachBioPlaceholder")
                : isBoxOwner
                  ? ta("boxBioPlaceholder")
                  : t("bioPlaceholder")
            }
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={isCoach || isBoxOwner ? 4 : 3}
          />
          {isCoach && (
            <p className="text-xs text-muted-foreground mt-1">
              {ta("coachBioHint")}
            </p>
          )}
          {isBoxOwner && (
            <p className="text-xs text-muted-foreground mt-1">
              {ta("boxBioHint")}
            </p>
          )}
        </div>

        {isAthlete && (
          <p className="text-xs text-muted-foreground rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
            {ts("profileLegacyHint")}{" "}
            <Link
              href="/legacy"
              className="font-semibold text-orange-400 underline underline-offset-2"
            >
              Legacy
            </Link>
            {" · "}
            {ts("profileLegacyHintDetail")}
          </p>
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

      <div className="md:hidden fixed bottom-24 left-0 right-0 z-30 px-4 safe-bottom">
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
