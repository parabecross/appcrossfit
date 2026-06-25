"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/routing";
import type { Profile } from "@/types/database";
import Image from "next/image";

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

  const save = async () => {
    setLoading(true);
    let foto_url = profile.foto_url;

    if (photo) {
      const ext = photo.name.split(".").pop();
      const path = `${profile.user_id}/avatar.${ext}`;
      await supabase.storage.from("avatars").upload(path, photo, {
        upsert: true,
      });
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      foto_url = data.publicUrl;
    }

    await supabase
      .from("profiles")
      .update({ ...form, foto_url })
      .eq("id", profile.id);

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
          {profile.foto_url && (
            <Image
              src={profile.foto_url}
              alt=""
              width={80}
              height={80}
              className="rounded-full object-cover"
            />
          )}
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
          <div>
            <Label>{t("photo")}</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button onClick={save} disabled={loading}>
            {loading ? tc("loading") : tc("save")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
