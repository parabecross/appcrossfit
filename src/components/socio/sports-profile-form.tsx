"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/routing";
import type { AtletaPerfilDeportivo } from "@/types/database";

export function SportsProfileForm({
  profileId,
  initial,
}: {
  profileId: string;
  initial: AtletaPerfilDeportivo | null;
}) {
  const t = useTranslations("progress.sportsProfile");
  const tc = useTranslations("common");
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    peso_corporal_kg: initial?.peso_corporal_kg?.toString() ?? "",
    estatura_cm: initial?.estatura_cm?.toString() ?? "",
    anos_entrenando: initial?.anos_entrenando?.toString() ?? "",
    modalidad_favorita: initial?.modalidad_favorita ?? "",
    notas: initial?.notas ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setLoading(true);
    setError(null);
    setSaved(false);

    const payload = {
      usuario_id: profileId,
      peso_corporal_kg: form.peso_corporal_kg
        ? parseFloat(form.peso_corporal_kg)
        : null,
      estatura_cm: form.estatura_cm ? parseInt(form.estatura_cm, 10) : null,
      anos_entrenando: form.anos_entrenando
        ? parseInt(form.anos_entrenando, 10)
        : null,
      modalidad_favorita: form.modalidad_favorita.trim() || null,
      notas: form.notas.trim() || null,
    };

    const { error: upsertError } = await supabase
      .from("atleta_perfil_deportivo")
      .upsert(payload, { onConflict: "usuario_id" });

    setLoading(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    setSaved(true);
    router.refresh();
  };

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 md:p-5 space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-400/90">
          {t("label")}
        </p>
        <h3 className="text-base font-bold mt-1">{t("title")}</h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>{t("weight")}</Label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="75"
            value={form.peso_corporal_kg}
            onChange={(e) =>
              setForm({ ...form, peso_corporal_kg: e.target.value })
            }
          />
        </div>
        <div>
          <Label>{t("height")}</Label>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="175"
            value={form.estatura_cm}
            onChange={(e) =>
              setForm({ ...form, estatura_cm: e.target.value })
            }
          />
        </div>
        <div>
          <Label>{t("yearsTraining")}</Label>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="3"
            value={form.anos_entrenando}
            onChange={(e) =>
              setForm({ ...form, anos_entrenando: e.target.value })
            }
          />
        </div>
        <div>
          <Label>{t("favoriteModality")}</Label>
          <Input
            placeholder={t("favoriteModalityPlaceholder")}
            value={form.modalidad_favorita}
            onChange={(e) =>
              setForm({ ...form, modalidad_favorita: e.target.value })
            }
          />
        </div>
      </div>

      <div>
        <Label>{t("notes")}</Label>
        <Textarea
          rows={2}
          placeholder={t("notesPlaceholder")}
          value={form.notas}
          onChange={(e) => setForm({ ...form, notas: e.target.value })}
        />
      </div>

      {error && (
        <p className="text-sm text-red-400 text-center">{error}</p>
      )}
      {saved && (
        <p className="text-sm text-green-400 text-center">{t("saved")}</p>
      )}

      <Button onClick={save} disabled={loading} className="w-full sm:w-auto">
        {loading ? tc("loading") : tc("save")}
      </Button>
    </div>
  );
}
