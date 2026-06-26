"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Award,
  Dumbbell,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/routing";
import {
  PR_EXERCISES,
  SKILL_KEYS,
  SKILL_PROGRESS,
} from "@/lib/progreso/constants";
import {
  comparePrDelta,
  countAchievedSkills,
  formatPrValue,
  getLatestPrPerExercise,
  getPreviousPr,
  isPrImprovement,
  parseTimeInput,
  secondsToTimeInput,
  suggestNextGoal,
} from "@/lib/progreso/helpers";
import { getPrMotivationMessage } from "@/lib/progreso/motivation";
import { cn, formatShortDay } from "@/lib/utils";
import type {
  AtletaPrMarca,
  AtletaSkill,
  AtletaSkillHistorial,
  SkillEstado,
} from "@/types/database";

type Tab = "prs" | "skills" | "history";

export function AthleteProgress({
  profileId,
  marcas: initialMarcas,
  skills: initialSkills,
  skillHistorial: initialHist,
  locale,
}: {
  profileId: string;
  marcas: AtletaPrMarca[];
  skills: AtletaSkill[];
  skillHistorial: AtletaSkillHistorial[];
  locale: string;
}) {
  const t = useTranslations("progress");
  const tc = useTranslations("common");
  const router = useRouter();
  const supabase = createClient();

  const [marcas, setMarcas] = useState(initialMarcas);
  const [skills, setSkills] = useState(initialSkills);
  const [skillHistorial, setSkillHistorial] = useState(initialHist);
  const [tab, setTab] = useState<Tab>("prs");
  const [prOpen, setPrOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState(PR_EXERCISES[0].key);
  const [prForm, setPrForm] = useState({
    valor: "",
    fecha: new Date().toISOString().slice(0, 10),
    notas: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);

  const latestPrs = useMemo(() => getLatestPrPerExercise(marcas), [marcas]);
  const achievedSkills = countAchievedSkills(skills);
  const nextGoal = suggestNextGoal(latestPrs, skills);

  const latestPr = useMemo(() => {
    if (marcas.length === 0) return null;
    return [...marcas].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  }, [marcas]);
  const latestSkill = useMemo(() => {
    if (skills.length === 0) return null;
    return [...skills].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )[0];
  }, [skills]);

  const exerciseDef = PR_EXERCISES.find((e) => e.key === selectedExercise)!;

  const openPrDialog = (ejercicio?: string) => {
    const key = ejercicio ?? PR_EXERCISES[0].key;
    const latest = latestPrs.get(key);
    const def = PR_EXERCISES.find((e) => e.key === key)!;
    setSelectedExercise(key);
    setPrForm({
      valor: latest
        ? def.timeInput
          ? secondsToTimeInput(latest.valor)
          : String(latest.valor)
        : "",
      fecha: new Date().toISOString().slice(0, 10),
      notas: "",
    });
    setError(null);
    setPrOpen(true);
  };

  const savePr = async () => {
    setLoading(true);
    setError(null);
    setCelebration(null);

    const def = PR_EXERCISES.find((e) => e.key === selectedExercise)!;
    let valor: number;

    if (def.timeInput) {
      const parsed = parseTimeInput(prForm.valor);
      if (parsed === null || parsed <= 0) {
        setError(t("invalidValue"));
        setLoading(false);
        return;
      }
      valor = parsed;
    } else {
      valor = parseFloat(prForm.valor);
      if (Number.isNaN(valor) || valor <= 0) {
        setError(t("invalidValue"));
        setLoading(false);
        return;
      }
    }

    const previous = getPreviousPr(marcas, selectedExercise);
    const improved = isPrImprovement(
      selectedExercise,
      valor,
      previous?.valor ?? null
    );

    const { data, error: insertError } = await supabase
      .from("atleta_pr_marcas")
      .insert({
        usuario_id: profileId,
        ejercicio: selectedExercise,
        valor,
        unidad: def.unit,
        fecha: prForm.fecha,
        notas: prForm.notas.trim() || null,
      })
      .select("*")
      .single();

    setLoading(false);

    if (insertError || !data) {
      setError(insertError?.message ?? tc("error"));
      return;
    }

    setMarcas((prev) => [data as AtletaPrMarca, ...prev]);
    setPrOpen(false);

    if (improved) {
      const delta = previous
        ? comparePrDelta(selectedExercise, valor, previous.valor, def.unit)
        : "";
      setCelebration(
        `${getPrMotivationMessage(locale)}${delta ? ` (${delta})` : ""}`
      );
    }

    router.refresh();
  };

  const updateSkill = async (skillKey: string, estado: SkillEstado) => {
    setLoading(true);
    setError(null);

    const existing = skills.find((s) => s.skill === skillKey);

    if (existing) {
      const { data, error: updateError } = await supabase
        .from("atleta_skills")
        .update({ estado })
        .eq("id", existing.id)
        .select("*")
        .single();

      setLoading(false);
      if (updateError || !data) {
        setError(updateError?.message ?? tc("error"));
        return;
      }

      setSkills((prev) =>
        prev.map((s) => (s.id === existing.id ? (data as AtletaSkill) : s))
      );
    } else {
      const { data, error: insertError } = await supabase
        .from("atleta_skills")
        .insert({
          usuario_id: profileId,
          skill: skillKey,
          estado,
        })
        .select("*")
        .single();

      setLoading(false);
      if (insertError || !data) {
        setError(insertError?.message ?? tc("error"));
        return;
      }

      setSkills((prev) => [data as AtletaSkill, ...prev]);
    }

    const { data: hist } = await supabase
      .from("atleta_skill_historial")
      .select("*")
      .eq("usuario_id", profileId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (hist) setSkillHistorial(hist as AtletaSkillHistorial[]);
    router.refresh();
  };

  const skillState = (key: string): SkillEstado => {
    return skills.find((s) => s.skill === key)?.estado ?? "en_proceso";
  };

  const skillBadgeVariant = (estado: SkillEstado) => {
    if (estado === "dominado") return "success" as const;
    if (estado === "logrado") return "warning" as const;
    return "secondary" as const;
  };

  return (
    <div className="space-y-5">
      {celebration && (
        <div className="flex gap-3 items-start rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3">
          <Trophy className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
          <div>
            <Badge variant="success" className="mb-1.5">
              {t("newPrBadge")}
            </Badge>
            <p className="text-sm text-green-200">{celebration}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          icon={Trophy}
          label={t("lastPr")}
          value={
            latestPr
              ? `${t(`exercises.${latestPr.ejercicio}`)} · ${formatPrValue(latestPr.valor, latestPr.unidad)}`
              : t("noData")
          }
        />
        <StatCard
          icon={Dumbbell}
          label={t("totalPrs")}
          value={String(marcas.length)}
        />
        <StatCard
          icon={Award}
          label={t("skillsAchieved")}
          value={`${achievedSkills}/${SKILL_KEYS.length}`}
        />
        <StatCard
          icon={Sparkles}
          label={t("lastSkillUpdate")}
          value={
            latestSkill
              ? t(`skills.${latestSkill.skill}`)
              : t("noData")
          }
        />
        <StatCard
          icon={Target}
          label={t("nextGoal")}
          value={
            nextGoal
              ? PR_EXERCISES.some((e) => e.key === nextGoal)
                ? t(`exercises.${nextGoal}`)
                : t(`skills.${nextGoal}`)
              : t("noData")
          }
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(["prs", "skills", "history"] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-all",
              tab === key
                ? "brand-gradient text-white"
                : "bg-secondary/60 text-muted-foreground"
            )}
          >
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-400 text-center rounded-xl bg-red-500/10 px-4 py-2">
          {error}
        </p>
      )}

      {tab === "prs" && (
        <div className="space-y-4">
          {PR_EXERCISES.filter((ex) => latestPrs.has(ex.key)).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center space-y-4">
              <p className="text-sm text-muted-foreground px-6">
                {t("noPrsYet")}
              </p>
              <Button className="gap-1.5" onClick={() => openPrDialog()}>
                <Plus className="h-4 w-4" />
                {t("addRecord")}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                <Button size="sm" className="gap-1.5" onClick={() => openPrDialog()}>
                  <Plus className="h-4 w-4" />
                  {t("addRecord")}
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {PR_EXERCISES.filter((ex) => latestPrs.has(ex.key)).map((ex) => {
                  const latest = latestPrs.get(ex.key)!;
                  const previous = getPreviousPr(marcas, ex.key, latest.id);
                  const delta =
                    previous
                      ? comparePrDelta(ex.key, latest.valor, previous.valor, ex.unit)
                      : "";

                  return (
                    <Card key={ex.key} className="border-white/5 rounded-2xl">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base">
                            {t(`exercises.${ex.key}`)}
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-primary"
                            onClick={() => openPrDialog(ex.key)}
                          >
                            {tc("edit")}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-2xl font-black brand-text">
                          {formatPrValue(latest.valor, latest.unidad)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatShortDay(latest.fecha, locale)}
                        </p>
                        {delta && (
                          <div className="flex items-center gap-1.5 text-xs text-green-400">
                            <TrendingUp className="h-3.5 w-3.5" />
                            {t("vsPrevious", { delta })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "skills" && (
        <div className="space-y-3">
          {SKILL_KEYS.map((key) => {
            const estado = skillState(key);
            return (
              <Card key={key} className="border-white/5 rounded-2xl">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{t(`skills.${key}`)}</p>
                    <Badge variant={skillBadgeVariant(estado)}>
                      {t(`skillStatus.${estado}`)}
                    </Badge>
                  </div>
                  <Progress value={SKILL_PROGRESS[estado]} className="h-2" />
                  <Select
                    value={estado}
                    onValueChange={(v) => updateSkill(key, v as SkillEstado)}
                    disabled={loading}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en_proceso">
                        {t("skillStatus.en_proceso")}
                      </SelectItem>
                      <SelectItem value="logrado">
                        {t("skillStatus.logrado")}
                      </SelectItem>
                      <SelectItem value="dominado">
                        {t("skillStatus.dominado")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-3">
          {marcas.length === 0 && skillHistorial.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("noHistory")}
            </p>
          ) : (
            <>
              {marcas.slice(0, 15).map((m) => (
                <div
                  key={m.id}
                  className="flex gap-3 rounded-xl border border-white/5 bg-card/50 px-4 py-3"
                >
                  <Dumbbell className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {t(`exercises.${m.ejercicio}`)} —{" "}
                      {formatPrValue(m.valor, m.unidad)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatShortDay(m.fecha, locale)}
                    </p>
                    {m.notas && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {m.notas}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {skillHistorial.slice(0, 10).map((h) => (
                <div
                  key={h.id}
                  className="flex gap-3 rounded-xl border border-white/5 bg-card/50 px-4 py-3"
                >
                  <Sparkles className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {(() => {
                        const sk = skills.find((s) => s.id === h.skill_id);
                        return sk ? t(`skills.${sk.skill}`) : t("skillUpdate");
                      })()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {h.estado_anterior
                        ? `${t(`skillStatus.${h.estado_anterior}`)} → ${t(`skillStatus.${h.estado_nuevo}`)}`
                        : t(`skillStatus.${h.estado_nuevo}`)}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <Dialog open={prOpen} onOpenChange={setPrOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("addRecord")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("exercise")}</Label>
              <Select
                value={selectedExercise}
                onValueChange={(v) => {
                  setSelectedExercise(v);
                  const latest = latestPrs.get(v);
                  const def = PR_EXERCISES.find((e) => e.key === v)!;
                  setPrForm((f) => ({
                    ...f,
                    valor: latest
                      ? def.timeInput
                        ? secondsToTimeInput(latest.valor)
                        : String(latest.valor)
                      : "",
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PR_EXERCISES.map((ex) => (
                    <SelectItem key={ex.key} value={ex.key}>
                      {t(`exercises.${ex.key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>
                {exerciseDef.timeInput
                  ? t("valueTime")
                  : t(`unit.${exerciseDef.unit}`)}
              </Label>
              <Input
                value={prForm.valor}
                placeholder={
                  exerciseDef.timeInput ? "7:30" : exerciseDef.unit === "lbs" ? "225" : "20"
                }
                onChange={(e) =>
                  setPrForm({ ...prForm, valor: e.target.value })
                }
              />
            </div>
            <div>
              <Label>{t("date")}</Label>
              <Input
                type="date"
                value={prForm.fecha}
                onChange={(e) =>
                  setPrForm({ ...prForm, fecha: e.target.value })
                }
              />
            </div>
            <div>
              <Label>{t("notes")}</Label>
              <Textarea
                value={prForm.notas}
                placeholder={t("notesPlaceholder")}
                onChange={(e) =>
                  setPrForm({ ...prForm, notas: e.target.value })
                }
                rows={2}
              />
            </div>
            <Button onClick={savePr} disabled={loading} className="w-full">
              {loading ? tc("loading") : tc("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="border-white/5 rounded-2xl">
      <CardContent className="p-4 space-y-2">
        <Icon className="h-4 w-4 text-primary" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-semibold leading-snug line-clamp-2">{value}</p>
      </CardContent>
    </Card>
  );
}
