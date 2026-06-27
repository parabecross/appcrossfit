"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Download, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SocioPageHeader } from "@/components/socio/socio-page-header";
import { AthleteCard } from "@/components/legacy/cards/athlete-card";
import { buildAthleteCardData } from "@/lib/legacy/build-athlete-card";
import {
  downloadPng,
  exportCardToPng,
  legacyFilename,
  sharePng,
} from "@/lib/legacy/export-card";
import type { AthleticLevel, LegacyCardFormat } from "@/lib/legacy/types";
import { LEGACY_CARD_DIMENSIONS } from "@/lib/legacy/types";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import type {
  AtletaObjetivo,
  AtletaPerfilDeportivo,
  Profile,
} from "@/types/database";

const LEVELS: AthleticLevel[] = [
  "beginner",
  "intermediate",
  "advanced",
  "rx",
];

const DISCIPLINES = [
  "CrossFit",
  "Hyrox",
  "Weightlifting",
  "Gymnastics",
  "Functional Fitness",
  "Endurance",
] as const;

function previewScaleForFormat(format: LegacyCardFormat): number {
  if (typeof window === "undefined") return 0.28;
  const maxW = Math.min(window.innerWidth - 48, 420);
  const { width } = LEGACY_CARD_DIMENSIONS[format];
  return Math.min(maxW / width, 0.35);
}

function sanitizeYears(value: number | null | undefined): string {
  if (value == null || value < 0) return "";
  return String(value);
}

function parseOptionalInt(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseOptionalFloat(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

const DOWNLOAD_FORMATS: {
  key: LegacyCardFormat;
  labelKey: "story" | "post" | "square";
  size: string;
}[] = [
  { key: "story", labelKey: "story", size: "1080 × 1920" },
  { key: "post", labelKey: "post", size: "1080 × 1350" },
  { key: "square", labelKey: "square", size: "1080 × 1080" },
];

export function LegacyClient({
  profile,
  perfilDeportivo,
  activeGoal,
  boxName,
  boxLogoUrl,
}: {
  profile: Profile;
  perfilDeportivo: AtletaPerfilDeportivo | null;
  activeGoal: AtletaObjetivo | null;
  boxName: string;
  boxLogoUrl: string | null;
}) {
  const t = useTranslations("legacy");
  const tc = useTranslations("common");
  const router = useRouter();
  const supabase = createClient();
  const storyExportRef = useRef<HTMLDivElement>(null);
  const postExportRef = useRef<HTMLDivElement>(null);
  const squareExportRef = useRef<HTMLDivElement>(null);
  const exportRefs = {
    story: storyExportRef,
    post: postExportRef,
    square: squareExportRef,
  };

  const [format, setFormat] = useState<LegacyCardFormat>("story");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    fecha_nacimiento: perfilDeportivo?.fecha_nacimiento ?? "",
    disciplina: perfilDeportivo?.disciplina ?? perfilDeportivo?.modalidad_favorita ?? "",
    nivel_deportivo: (perfilDeportivo?.nivel_deportivo ?? "") as AthleticLevel | "",
    frase_legacy: perfilDeportivo?.frase_legacy ?? "",
    peso_corporal_kg: perfilDeportivo?.peso_corporal_kg?.toString() ?? "",
    estatura_cm: perfilDeportivo?.estatura_cm?.toString() ?? "",
    anos_entrenando: sanitizeYears(perfilDeportivo?.anos_entrenando),
  });

  const previewPerfil = useMemo(
    (): AtletaPerfilDeportivo => ({
      usuario_id: profile.id,
      peso_corporal_kg: form.peso_corporal_kg
        ? parseFloat(form.peso_corporal_kg)
        : null,
      estatura_cm: form.estatura_cm ? parseInt(form.estatura_cm, 10) : null,
      anos_entrenando: (() => {
        const years = parseOptionalInt(form.anos_entrenando);
        return years !== null && years >= 0 ? years : null;
      })(),
      modalidad_favorita: null,
      notas: perfilDeportivo?.notas ?? null,
      updated_at: perfilDeportivo?.updated_at ?? new Date().toISOString(),
      fecha_nacimiento: form.fecha_nacimiento || null,
      disciplina: form.disciplina.trim() || null,
      nivel_deportivo: form.nivel_deportivo || null,
      frase_legacy: form.frase_legacy.trim() || null,
    }),
    [form, profile.id, perfilDeportivo]
  );

  const cardData = useMemo(
    () =>
      buildAthleteCardData({
        profile,
        perfil: previewPerfil,
        activeGoal,
        boxName,
        boxLogoUrl,
        defaultTagline: t("defaultTagline"),
      }),
    [profile, previewPerfil, activeGoal, boxName, boxLogoUrl, t]
  );

  const cardLabels = useMemo(
    () => ({
      legacy: t("card.badge"),
      byAthron: t("card.byAthron"),
      levelLabel: t("card.level"),
      level: {
        beginner: t("levels.beginner"),
        intermediate: t("levels.intermediate"),
        advanced: t("levels.advanced"),
        rx: t("levels.rx"),
      },
      years: t("card.years"),
      yearsUnit: t("card.yearsUnit"),
      age: t("card.age"),
      ageUnit: t("card.ageUnit"),
      height: t("card.height"),
      heightUnit: t("card.heightUnit"),
      weight: t("card.weight"),
      weightUnit: t("card.weightUnit"),
      goal: t("card.goal"),
    }),
    [t]
  );

  const save = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    const years = parseOptionalInt(form.anos_entrenando);
    const height = parseOptionalInt(form.estatura_cm);
    const weight = parseOptionalFloat(form.peso_corporal_kg);

    if (years !== null && years < 0) {
      setError(t("errors.yearsInvalid"));
      setLoading(false);
      return;
    }
    if (height !== null && height <= 0) {
      setError(t("errors.heightInvalid"));
      setLoading(false);
      return;
    }
    if (weight !== null && weight <= 0) {
      setError(t("errors.weightInvalid"));
      setLoading(false);
      return;
    }

    const { error: upsertError } = await supabase
      .from("atleta_perfil_deportivo")
      .upsert(
        {
          usuario_id: profile.id,
          peso_corporal_kg: weight,
          estatura_cm: height,
          anos_entrenando: years !== null && years >= 0 ? years : null,
          notas: perfilDeportivo?.notas ?? null,
          fecha_nacimiento: form.fecha_nacimiento || null,
          disciplina: form.disciplina.trim() || null,
          nivel_deportivo: form.nivel_deportivo || null,
          frase_legacy: form.frase_legacy.trim() || null,
        },
        { onConflict: "usuario_id" }
      );

    setLoading(false);
    if (upsertError) {
      setError(
        upsertError.message.includes("anos_entrenando_check")
          ? t("errors.yearsInvalid")
          : upsertError.message
      );
      return;
    }
    setMessage(t("saved"));
    router.refresh();
  };

  const runExport = useCallback(
    async (targetFormat: LegacyCardFormat, mode: "download" | "share") => {
      const node = exportRefs[targetFormat].current;
      if (!node) return;
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const dataUrl = await exportCardToPng(node, targetFormat);
        const filename = legacyFilename(profile.nombre_completo, targetFormat);
        if (mode === "share") {
          const result = await sharePng(
            dataUrl,
            filename,
            `${profile.nombre_completo} — ATHRON`
          );
          setMessage(
            result === "shared" ? t("shareSuccess") : t("downloadSuccess")
          );
        } else {
          downloadPng(dataUrl, filename);
          setMessage(t("downloadSuccess"));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : tc("error"));
      } finally {
        setLoading(false);
      }
    },
    [profile.nombre_completo, t, tc]
  );

  const [scale, setScale] = useState(0.28);

  useEffect(() => {
    setScale(previewScaleForFormat(format));
    const onResize = () => setScale(previewScaleForFormat(format));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [format]);

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-28 md:pb-10">
      <SocioPageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        badge={
          <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-400">
            <Sparkles className="h-3 w-3" />
            Legacy
          </span>
        }
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="min-w-0 space-y-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 md:p-6">
          <div>
            <h2 className="text-sm font-bold">{t("editor.title")}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {t("editor.hint")}
            </p>
          </div>

          {!profile.foto_url && (
            <p className="text-xs text-orange-400/90 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2">
              {t("editor.photoHint")}{" "}
              <Link href="/perfil" className="underline font-medium">
                {t("editor.photoLink")}
              </Link>
            </p>
          )}

          <p className="text-xs text-muted-foreground rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            {t("editor.nameHint")}{" "}
            <span className="font-semibold text-foreground">
              {profile.nombre_completo}
            </span>
            {" · "}
            <Link href="/perfil" className="text-orange-400 underline font-medium">
              {t("editor.nameLink")}
            </Link>
          </p>

          <div className="min-w-0 space-y-4">
            <div className="min-w-0 w-full overflow-hidden">
              <Label>{t("fields.birthDate")}</Label>
              <Input
                type="date"
                className="w-full max-w-full min-w-0 box-border [color-scheme:dark]"
                value={form.fecha_nacimiento}
                onChange={(e) =>
                  setForm({ ...form, fecha_nacimiento: e.target.value })
                }
              />
            </div>
            <div>
              <Label>{t("fields.discipline")}</Label>
              <Select
                value={form.disciplina || "__none__"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    disciplina: v === "__none__" ? "" : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("fields.disciplinePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {DISCIPLINES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("fields.level")}</Label>
              <Select
                value={form.nivel_deportivo || "__none__"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    nivel_deportivo:
                      v === "__none__" ? "" : (v as AthleticLevel),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {t(`levels.${l}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("fields.height")}</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.estatura_cm}
                  onChange={(e) =>
                    setForm({ ...form, estatura_cm: e.target.value })
                  }
                  placeholder="175"
                />
              </div>
              <div>
                <Label>{t("fields.weight")}</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.peso_corporal_kg}
                  onChange={(e) =>
                    setForm({ ...form, peso_corporal_kg: e.target.value })
                  }
                  placeholder="78"
                />
              </div>
            </div>
            <div>
              <Label>{t("fields.years")}</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={form.anos_entrenando}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || /^\d+$/.test(value)) {
                    setForm({ ...form, anos_entrenando: value });
                  }
                }}
                placeholder="3"
              />
            </div>
            <div>
              <Label>{t("fields.tagline")}</Label>
              <Textarea
                value={form.frase_legacy}
                onChange={(e) =>
                  setForm({ ...form, frase_legacy: e.target.value })
                }
                placeholder={t("defaultTagline")}
                rows={2}
                maxLength={120}
              />
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => void save()}
            disabled={loading}
          >
            {loading ? tc("loading") : t("editor.save")}
          </Button>
          {message && (
            <p className="text-sm text-green-400 text-center">{message}</p>
          )}
          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold">{t("preview.title")}</h2>
            <div className="flex rounded-lg border border-white/10 p-0.5">
              {(["story", "post", "square"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[10px] font-bold uppercase transition-colors",
                    format === f
                      ? "brand-gradient text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f === "story" ? "Story" : f === "post" ? "Post" : "1:1"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-center overflow-hidden rounded-2xl border border-white/15 bg-zinc-800/25 p-3">
            <AthleteCard
              data={cardData}
              format={format}
              previewScale={scale}
              labels={cardLabels}
            />
          </div>

          <div className="space-y-3 border-t border-white/10 pt-4">
            <Button
              variant="default"
              className="w-full h-12 text-base font-semibold"
              disabled={loading}
              onClick={() => void runExport(format, "share")}
            >
              <Share2 className="h-4 w-4 mr-2 shrink-0" />
              {t("actions.share")}
            </Button>

            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
              {t("actions.downloadTitle")}
            </p>

            <div className="flex flex-col gap-2">
              {DOWNLOAD_FORMATS.map(({ key, labelKey, size }) => (
                <Button
                  key={key}
                  variant="outline"
                  className="h-auto w-full justify-between gap-3 px-4 py-3"
                  disabled={loading}
                  onClick={() => void runExport(key, "download")}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Download className="h-4 w-4 shrink-0 text-orange-400" />
                    <span className="font-medium">
                      {t(`actions.format.${labelKey}`)}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {size}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Off-screen export target at full resolution */}
      <div
        className="pointer-events-none fixed left-[-9999px] top-0 opacity-0"
        aria-hidden
      >
        {(["story", "post", "square"] as const).map((f) => (
          <AthleteCard
            key={f}
            ref={exportRefs[f]}
            data={cardData}
            format={f}
            labels={cardLabels}
          />
        ))}
      </div>
    </div>
  );
}
