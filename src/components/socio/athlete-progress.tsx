"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Trash2,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
} from "@/lib/progreso/constants";
import {
  comparePrDelta,
  formatPrValue,
  formatRecordTipoLabel,
  getLatestPrPerExercise,
  getPreviousPr,
  getRecordTipo,
  isPrImprovement,
  parseTimeInput,
  secondsToTimeInput,
} from "@/lib/progreso/helpers";
import { getPrMotivationMessage } from "@/lib/progreso/motivation";
import {
  resolveSkillRankingSync,
} from "@/lib/ranking/achievement-sync";
import { cn, formatCompactDate } from "@/lib/utils";
import { ProgressBadgesSummary } from "@/components/socio/progress/progress-badges-summary";
import { ProgressGoals } from "@/components/socio/progress/progress-goals";
import { ProgressHistoryPanel } from "@/components/socio/progress/progress-history-panel";
import { ProgressRankingCard } from "@/components/socio/progress/progress-ranking-card";
import type { BadgeInput } from "@/lib/progreso/badges";
import type { UserAthronSummary } from "@/lib/ranking/aggregate";
import type {
  AtletaObjetivo,
  AtletaPrMarca,
  AtletaSkill,
  AtletaSkillHistorial,
  SkillEstado,
  RecordTipo,
} from "@/types/database";

type Tab = "prs" | "skills" | "goals" | "history";

export function AthleteProgress({
  profileId,
  marcas: initialMarcas,
  skills: initialSkills,
  skillHistorial: initialHist,
  objetivos: initialObjetivos,
  athronSummary,
  badgeInput,
  boxSlug,
  locale,
}: {
  profileId: string;
  marcas: AtletaPrMarca[];
  skills: AtletaSkill[];
  skillHistorial: AtletaSkillHistorial[];
  objetivos: AtletaObjetivo[];
  athronSummary: UserAthronSummary;
  badgeInput: BadgeInput;
  boxSlug?: string;
  locale: string;
}) {
  const t = useTranslations("progress");
  const tc = useTranslations("common");
  const router = useRouter();
  const supabase = createClient();

  const [marcas, setMarcas] = useState(initialMarcas);
  const [skills, setSkills] = useState(initialSkills);
  const [skillHistorial, setSkillHistorial] = useState(initialHist);
  const [objetivos] = useState(initialObjetivos);
  const [tab, setTab] = useState<Tab>("prs");
  const [prOpen, setPrOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState(PR_EXERCISES[0].key);
  const [prForm, setPrForm] = useState({
    recordTipo: "pr" as RecordTipo,
    rmReps: "5",
    valor: "",
    fecha: new Date().toISOString().slice(0, 10),
    notas: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AtletaPrMarca | null>(null);

  const latestMarcas = useMemo(() => getLatestPrPerExercise(marcas), [marcas]);

  const applySkillRankingSync = async (
    skillKey: string,
    previous: SkillEstado | null,
    next: SkillEstado | "none"
  ) => {
    const actions = resolveSkillRankingSync(skillKey, previous, next);
    for (const { action, badgeKey } of actions) {
      await syncSkillAchievement(action, badgeKey);
    }
  };

  const syncSkillAchievement = async (
    action: "award" | "revoke",
    badgeKey: string
  ) => {
    const path =
      action === "award"
        ? "/api/ranking/award-achievement"
        : "/api/ranking/revoke-achievement";
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuarioId: profileId,
        badgeKey,
      }),
    });
    if (!res.ok) {
      throw new Error(t("rankingSyncFailed"));
    }
  };

  const awardPrAchievements = async (marcaId: string) => {
    const res = await fetch("/api/ranking/award-pr-achievements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuarioId: profileId,
        marcaId,
      }),
    });
    if (!res.ok) {
      throw new Error(t("rankingSyncFailed"));
    }
    return (await res.json()) as { awarded: string[] };
  };

  const revokePrAchievements = async (marca: AtletaPrMarca) => {
    const res = await fetch("/api/ranking/revoke-pr-achievements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuarioId: profileId,
        marcaId: marca.id,
        marcaSnapshot: marca,
      }),
    });
    if (!res.ok) {
      throw new Error(t("rankingSyncFailed"));
    }
  };

  const exerciseDef = PR_EXERCISES.find((e) => e.key === selectedExercise)!;

  const openPrDialog = (
    ejercicio?: string,
    recordTipo: RecordTipo = "pr",
    initialRmReps?: number
  ) => {
    const key = ejercicio ?? PR_EXERCISES[0].key;
    const defaultRmReps = initialRmReps ? String(initialRmReps) : "5";
    const latest = Array.from(latestMarcas.values()).find(
      (m) =>
        m.ejercicio === key &&
        getRecordTipo(m) === recordTipo &&
        (recordTipo !== "rm" ||
          m.rm_reps === parseInt(defaultRmReps, 10))
    );
    const def = PR_EXERCISES.find((e) => e.key === key)!;
    setSelectedExercise(key);
    setPrForm({
      recordTipo,
      rmReps: latest?.rm_reps ? String(latest.rm_reps) : defaultRmReps,
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

    const rmReps =
      prForm.recordTipo === "rm" && def.unit === "lbs"
        ? parseInt(prForm.rmReps, 10)
        : null;

    if (prForm.recordTipo === "rm" && def.unit === "lbs" && (!rmReps || rmReps <= 0)) {
      setError(t("invalidReps"));
      setLoading(false);
      return;
    }

    const previous = getPreviousPr(
      marcas,
      selectedExercise,
      prForm.recordTipo,
      rmReps
    );
    const { data, error: insertError } = await supabase
      .from("atleta_pr_marcas")
      .insert({
        usuario_id: profileId,
        ejercicio: selectedExercise,
        record_tipo: prForm.recordTipo,
        rm_reps: rmReps,
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

    const isFirstOrImprovement =
      !previous || isPrImprovement(selectedExercise, valor, previous.valor);

    if (isFirstOrImprovement) {
      const delta = previous
        ? comparePrDelta(selectedExercise, valor, previous.valor, def.unit)
        : "";
      setCelebration(
        `${getPrMotivationMessage(locale)}${delta ? ` (${delta})` : ""}`
      );
    }

    try {
      await awardPrAchievements(data.id);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : tc("error"));
    }

    router.refresh();
  };

  const deletePr = async (marca: AtletaPrMarca) => {
    setLoading(true);
    setError(null);
    setCelebration(null);

    try {
      await revokePrAchievements(marca);
    } catch (syncError) {
      setLoading(false);
      setError(syncError instanceof Error ? syncError.message : tc("error"));
      return;
    }

    const { error: deleteError } = await supabase
      .from("atleta_pr_marcas")
      .delete()
      .eq("id", marca.id);

    if (deleteError) {
      setLoading(false);
      setError(deleteError.message);
      return;
    }

    const remaining = marcas.filter((m) => m.id !== marca.id);
    setMarcas(remaining);
    setDeleteTarget(null);

    setLoading(false);
    router.refresh();
  };

  const deleteSkillHistory = async (entry: AtletaSkillHistorial) => {
    setLoading(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from("atleta_skill_historial")
      .delete()
      .eq("id", entry.id);

    if (deleteError) {
      setLoading(false);
      setError(deleteError.message);
      return;
    }

    setSkillHistorial((prev) => prev.filter((h) => h.id !== entry.id));
    setLoading(false);
    router.refresh();
  };

  const updateSkill = async (skillKey: string, value: SkillEstado | "none") => {
    setLoading(true);
    setError(null);

    const existing = skills.find((s) => s.skill === skillKey);

    if (value === "none") {
      if (!existing) {
        setLoading(false);
        return;
      }

      const previousEstado = existing.estado;
      const { error: deleteError } = await supabase
        .from("atleta_skills")
        .delete()
        .eq("id", existing.id);

      if (deleteError) {
        setLoading(false);
        setError(deleteError.message);
        return;
      }

      setSkills((prev) => prev.filter((s) => s.id !== existing.id));

      try {
        await applySkillRankingSync(skillKey, previousEstado, "none");
      } catch (syncError) {
        setError(syncError instanceof Error ? syncError.message : tc("error"));
      }

      setLoading(false);
      router.refresh();
      return;
    }

    const estado = value;
    const previousEstado = existing?.estado ?? null;

    if (existing) {
      const { data, error: updateError } = await supabase
        .from("atleta_skills")
        .update({ estado })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (updateError || !data) {
        setLoading(false);
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

      if (insertError || !data) {
        setLoading(false);
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

    try {
      await applySkillRankingSync(skillKey, previousEstado, estado);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : tc("error"));
    }

    setLoading(false);
    router.refresh();
  };

  const skillState = (key: string): SkillEstado | null => {
    return skills.find((s) => s.skill === key)?.estado ?? null;
  };

  return (
    <div className="space-y-4">
      <ProgressRankingCard
        summary={athronSummary}
        locale={locale}
        boxSlug={boxSlug}
      />

      <ProgressBadgesSummary input={badgeInput} />

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
        {(["prs", "skills", "goals", "history"] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200",
              tab === key
                ? "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/20"
                : "bg-white/[0.04] text-muted-foreground border border-white/5 hover:border-orange-500/20"
            )}
          >
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === "prs" && celebration && (
        <div className="flex gap-3 items-start rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <Trophy className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
          <div>
            <Badge variant="success" className="mb-1.5">
              {t("newRecordBadge")}
            </Badge>
            <p className="text-sm text-green-200">{celebration}</p>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 text-center rounded-xl bg-red-500/10 px-4 py-2">
          {error}
        </p>
      )}

      {tab === "prs" && (
        <div className="space-y-4">
          {latestMarcas.size === 0 ? (
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
                {Array.from(latestMarcas.values())
                  .sort((a, b) => a.ejercicio.localeCompare(b.ejercicio))
                  .map((latest) => {
                  const tipo = getRecordTipo(latest);
                  const previous = getPreviousPr(
                    marcas,
                    latest.ejercicio,
                    tipo,
                    latest.rm_reps,
                    latest.id
                  );
                  const delta =
                    previous
                      ? comparePrDelta(
                          latest.ejercicio,
                          latest.valor,
                          previous.valor,
                          latest.unidad
                        )
                      : "";

                  return (
                    <Card
                      key={`${latest.ejercicio}-${tipo}-${latest.rm_reps ?? 0}`}
                      className="border-white/5 rounded-2xl"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <CardTitle className="text-base truncate">
                              {t(`exercises.${latest.ejercicio}`)}
                            </CardTitle>
                            <Badge variant="outline" className="shrink-0 text-[10px] px-1.5">
                              {formatRecordTipoLabel(latest, t)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-primary"
                              onClick={() =>
                                openPrDialog(
                                  latest.ejercicio,
                                  tipo,
                                  latest.rm_reps ?? undefined
                                )
                              }
                            >
                              {tc("edit")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-red-400 hover:text-red-300"
                              onClick={() => setDeleteTarget(latest)}
                              disabled={loading}
                              aria-label={t("deleteRecord")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-1">
                        <p className="text-2xl font-black brand-text">
                          {formatPrValue(latest.valor, latest.unidad)}
                        </p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {formatCompactDate(latest.fecha, locale)}
                        </p>
                        {delta && (
                          <div className="flex items-center gap-1.5 text-xs text-green-400 pt-1">
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
        <Card className="border-white/5 rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("skillsPanelTitle")}</CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("skillsPanelHint")}
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SKILL_KEYS.map((key) => {
                const estado = skillState(key);
                return (
                  <div
                    key={key}
                    className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
                  >
                    <p className="min-w-0 flex-1 text-sm font-medium leading-tight">
                      {t(`skills.${key}`)}
                    </p>
                    <Select
                      value={estado ?? "none"}
                      onValueChange={(v) =>
                        void updateSkill(
                          key,
                          v === "none" ? "none" : (v as SkillEstado)
                        )
                      }
                      disabled={loading}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-8 w-[7.25rem] shrink-0 rounded-lg border-white/10 px-2 text-xs",
                          estado === "dominado" &&
                            "border-green-500/30 text-green-400",
                          estado === "logrado" &&
                            "border-orange-500/30 text-orange-300",
                          estado === "en_proceso" &&
                            "border-sky-500/30 text-sky-400",
                          !estado && "text-muted-foreground"
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {t("skillStatus.none")}
                        </SelectItem>
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
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "goals" && (
        <ProgressGoals
          profileId={profileId}
          objetivos={objetivos}
          locale={locale}
        />
      )}

      {tab === "history" && (
        <ProgressHistoryPanel
          marcas={marcas}
          skills={skills}
          skillHistorial={skillHistorial}
          locale={locale}
          loading={loading}
          onDeletePr={deletePr}
          onDeleteSkillHistory={deleteSkillHistory}
        />
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("deleteRecordTitle")}</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("deleteRecordConfirm", {
                  record: `${t(`exercises.${deleteTarget.ejercicio}`)} · ${formatPrValue(deleteTarget.valor, deleteTarget.unidad)}`,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDeleteTarget(null)}
                  disabled={loading}
                >
                  {tc("cancel")}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => void deletePr(deleteTarget)}
                  disabled={loading}
                >
                  {loading ? tc("loading") : tc("delete")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={prOpen} onOpenChange={setPrOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("addRecord")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("recordType")}</Label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {(["pr", "rm"] as RecordTipo[]).map((tipo) => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => {
                      const reps = tipo === "rm" ? parseInt(prForm.rmReps, 10) : undefined;
                      const latest = Array.from(latestMarcas.values()).find(
                        (m) =>
                          m.ejercicio === selectedExercise &&
                          getRecordTipo(m) === tipo &&
                          (tipo !== "rm" || m.rm_reps === reps)
                      );
                      const def = PR_EXERCISES.find(
                        (e) => e.key === selectedExercise
                      )!;
                      setPrForm((f) => ({
                        ...f,
                        recordTipo: tipo,
                        valor: latest
                          ? def.timeInput
                            ? secondsToTimeInput(latest.valor)
                            : String(latest.valor)
                          : "",
                      }));
                    }}
                    className={cn(
                      "rounded-xl py-2.5 text-sm font-semibold transition-all border",
                      prForm.recordTipo === tipo
                        ? "brand-gradient text-white border-transparent"
                        : "bg-secondary/60 text-muted-foreground border-white/10"
                    )}
                  >
                    {t(`recordTipo.${tipo}`)}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {t(`recordTypeHint.${prForm.recordTipo}`)}
              </p>
            </div>
            <div>
              <Label>{t("exercise")}</Label>
              <Select
                value={selectedExercise}
                onValueChange={(v) => {
                  const reps =
                    prForm.recordTipo === "rm"
                      ? parseInt(prForm.rmReps, 10)
                      : undefined;
                  const latest = Array.from(latestMarcas.values()).find(
                    (m) =>
                      m.ejercicio === v &&
                      getRecordTipo(m) === prForm.recordTipo &&
                      (prForm.recordTipo !== "rm" || m.rm_reps === reps)
                  );
                  const def = PR_EXERCISES.find((e) => e.key === v)!;
                  setPrForm((f) => ({
                    ...f,
                    valor: latest
                      ? def.timeInput
                        ? secondsToTimeInput(latest.valor)
                        : String(latest.valor)
                      : "",
                  }));
                  setSelectedExercise(v);
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
            {prForm.recordTipo === "rm" && exerciseDef.unit === "lbs" && (
              <div>
                <Label>{t("rmReps")}</Label>
                <Select
                  value={prForm.rmReps}
                  onValueChange={(v) => {
                    const latest = Array.from(latestMarcas.values()).find(
                      (m) =>
                        m.ejercicio === selectedExercise &&
                        getRecordTipo(m) === "rm" &&
                        m.rm_reps === parseInt(v, 10)
                    );
                    setPrForm((f) => ({
                      ...f,
                      rmReps: v,
                      valor: latest ? String(latest.valor) : "",
                    }));
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 5, 10].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {t("rmRepsOption", { count: n })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                className="input-date-compact [color-scheme:dark]"
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
