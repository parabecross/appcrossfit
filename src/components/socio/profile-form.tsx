"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatarForUser } from "@/lib/avatars/upload";
import { PhotoUploadInput } from "@/components/auth/photo-upload-input";
import { useRouter } from "@/i18n/routing";
import type { Profile } from "@/types/database";

export function ProfileForm({ profile }: { profile: Profile }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({
    nombre_completo: profile.nombre_completo,
    telefono: profile.telefono ?? "",
    bio: profile.bio ?? "",
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setLoading(true);
    setError(null);
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

    router.refresh();
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-black brand-text">
        {tn("profile")}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>{profile.nombre_completo}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="profile-photo">{t("photo")}</Label>
            <PhotoUploadInput
              id="profile-photo"
              initialPreview={profile.foto_url}
              onChange={setPhoto}
            />
          </div>
          <div>
            <Label>{t("fullName")}</Label>
            <Input
              value={form.nombre_completo}
              onChange={(e) =>
                setForm({ ...form, nombre_completo: e.target.value })
              }
            />
          </div>
          <div>
            <Label>{t("phone")}</Label>
            <Input
              value={form.telefono}
              onChange={(e) =>
                setForm({ ...form, telefono: e.target.value })
              }
            />
          </div>
          <div>
            <Label>{t("bio")}</Label>
            <Textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </div>
          <Button onClick={save} disabled={loading}>
            {loading ? tc("loading") : tc("save")}
          </Button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
