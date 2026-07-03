"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AthleteAvatar } from "@/components/ui/athlete-avatar";
import {
  getSocioDisplayStatus,
  socioDisplayStatusBadgeVariant,
  type SocioDisplayStatus,
} from "@/lib/membresias/helpers";
import type { MembresiaWithPlan } from "@/lib/queries/memberships";
import type {
  AtletaMarcasSummary,
  AtletaSkillsSummary,
} from "@/lib/queries/atleta-summary";
import {
  formatPrValue,
  formatRecordTipoLabel,
} from "@/lib/progreso/helpers";
import { cn, formatDate } from "@/lib/utils";
import type { AtletaObjetivo, AtletaSkill, Profile } from "@/types/database";

export type AtletaResumenRow = {
  profile: Profile;
  membresia: MembresiaWithPlan | null;
  skills: AtletaSkillsSummary;
  marcas: AtletaMarcasSummary;
  activeGoals: AtletaObjetivo[];
};

function socioStatusLabel(
  status: SocioDisplayStatus,
  ts: (key: string) => string,
  tm: (key: string) => string,
  tmem: (key: string) => string,
  tadmin: (key: string) => string,
  tmy: (key: string) => string
): string {
  switch (status) {
    case "pendiente_pago":
      return ts("pendiente_pago");
    case "activo":
      return ts("activo");
    case "vencida":
      return tm("vencida");
    case "sin_membresia":
      return tmy("noMembership");
    case "por_vencer":
      return tadmin("socioStatusPorVencer");
  }
}

function skillBadgeVariant(estado: string) {
  if (estado === "dominado") return "success" as const;
  if (estado === "logrado") return "warning" as const;
  if (estado === "en_proceso") return "info" as const;
  return "secondary" as const;
}

function markedSkillsCount(skills: AtletaSkillsSummary) {
  return (
    skills.en_proceso.length + skills.logrado.length + skills.dominado.length
  );
}

function AtletaDetailBody({
  row,
  locale,
  status,
  t,
  ts,
  tm,
  tmem,
  tadmin,
  tprogress,
  hideUnmarkedSkills = false,
}: {
  row: AtletaResumenRow;
  locale: string;
  status: SocioDisplayStatus;
  t: (key: string, values?: Record<string, number>) => string;
  ts: (key: string) => string;
  tm: (key: string) => string;
  tmem: (key: string) => string;
  tadmin: (key: string) => string;
  tprogress: (key: string) => string;
  hideUnmarkedSkills?: boolean;
}) {
  const { profile, membresia, skills, marcas, activeGoals } = row;

  const skillGroups = [
    ...(hideUnmarkedSkills
      ? []
      : [
          {
            key: "sin_marcar" as const,
            label: t("notMarked"),
            skillKeys: skills.sin_marcar,
            items: [] as AtletaSkill[],
          },
        ]),
    {
      key: "en_proceso" as const,
      label: t("inProgress"),
      skillKeys: [] as string[],
      items: skills.en_proceso,
    },
    {
      key: "logrado" as const,
      label: t("achieved"),
      skillKeys: [] as string[],
      items: skills.logrado,
    },
    {
      key: "dominado" as const,
      label: t("dominated"),
      skillKeys: [] as string[],
      items: skills.dominado,
    },
  ];

  return (
    <>
      <div className="mt-3 space-y-1.5 md:mt-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("membershipStatus")}
        </p>
        <Badge variant={socioDisplayStatusBadgeVariant(status)}>
          {socioStatusLabel(status, ts, tm, tmem, tadmin, t)}
        </Badge>
        {membresia?.plan?.nombre && status !== "sin_membresia" && (
          <p className="text-xs text-muted-foreground">
            {membresia.plan.nombre}
            {membresia.fecha_fin
              ? ` · ${formatDate(membresia.fecha_fin, locale)}`
              : ""}
          </p>
        )}
        {profile.telefono && (
          <p className="text-xs text-muted-foreground md:hidden">
            {profile.telefono}
          </p>
        )}
      </div>

      <div className="space-y-4 pt-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {t("coachGoal")}
          </p>
          {activeGoals.length > 0 ? (
            <ul className="space-y-2">
              {activeGoals.map((goal) => (
                <li
                  key={goal.id}
                  className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2.5 space-y-1"
                >
                  <p className="text-sm leading-relaxed">{goal.nombre}</p>
                  {goal.fecha_objetivo && (
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {formatDate(goal.fecha_objetivo, locale)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noCoachGoal")}</p>
          )}
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {t("skills")}
          </p>
          {hideUnmarkedSkills && skills.sin_marcar.length > 0 && (
            <p className="text-xs text-muted-foreground mb-2">
              {t("unmarkedSkillsCount", { count: skills.sin_marcar.length })}
            </p>
          )}
          <div className="space-y-3">
            {skillGroups.map(({ key, label, skillKeys, items }) => {
              const count = skillKeys.length + items.length;
              if (count === 0) return null;

              return (
                <div key={key}>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                    {label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {skillKeys.map((skillKey) => (
                      <Badge
                        key={skillKey}
                        variant="outline"
                        className="text-[10px] font-medium text-muted-foreground"
                      >
                        {tprogress(`skills.${skillKey}`)}
                      </Badge>
                    ))}
                    {items.map((skill) => (
                      <Badge
                        key={skill.id}
                        variant={skillBadgeVariant(skill.estado)}
                        className="text-[10px] font-medium"
                      >
                        {tprogress(`skills.${skill.skill}`)}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {t("prsRm")}
          </p>
          {marcas.total === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noPrs")}</p>
          ) : (
            <ul className="space-y-2">
              {marcas.items.map((marca) => (
                <li
                  key={marca.id}
                  className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm"
                >
                  <p className="font-medium truncate">
                    {tprogress(`exercises.${marca.ejercicio}`)}
                  </p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {formatPrValue(marca.valor, marca.unidad)} ·{" "}
                    {formatRecordTipoLabel(marca, tprogress)} ·{" "}
                    {formatDate(marca.fecha, locale)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function AtletaMobileRow({
  row,
  locale,
  gymTimezone,
  expanded,
  onToggle,
  t,
  ts,
  tm,
  tmem,
  tadmin,
  tprogress,
}: {
  row: AtletaResumenRow;
  locale: string;
  gymTimezone?: string;
  expanded: boolean;
  onToggle: () => void;
  t: (key: string, values?: Record<string, number>) => string;
  ts: (key: string) => string;
  tm: (key: string) => string;
  tmem: (key: string) => string;
  tadmin: (key: string) => string;
  tprogress: (key: string) => string;
}) {
  const { profile, membresia, skills, marcas, activeGoals } = row;
  const status = getSocioDisplayStatus(profile, membresia, gymTimezone);
  const marked = markedSkillsCount(skills);

  return (
    <div className="rounded-xl border border-white/10 bg-card/50 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-3 text-left"
        aria-expanded={expanded}
      >
        <AthleteAvatar
          fotoUrl={profile.foto_url}
          seed={profile.id}
          name={profile.nombre_completo}
          className="h-10 w-10 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm truncate">
              {profile.nombre_completo}
            </p>
            <Badge
              variant={socioDisplayStatusBadgeVariant(status)}
              className="shrink-0 text-[10px] px-1.5 py-0"
            >
              {socioStatusLabel(status, ts, tm, tmem, tadmin, t)}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {t("mobileSummary", {
              goals: activeGoals.length,
              skills: marked,
              prs: marcas.total,
            })}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-white/10 px-3 pb-4">
          <AtletaDetailBody
            row={row}
            locale={locale}
            status={status}
            t={t}
            ts={ts}
            tm={tm}
            tmem={tmem}
            tadmin={tadmin}
            tprogress={tprogress}
            hideUnmarkedSkills
          />
        </div>
      )}
    </div>
  );
}

export function AtletasResumenList({
  athletes,
  locale,
  gymTimezone,
}: {
  athletes: AtletaResumenRow[];
  locale: string;
  gymTimezone?: string;
}) {
  const t = useTranslations("myAthletes");
  const tadmin = useTranslations("admin");
  const ts = useTranslations("accountStatus");
  const tm = useTranslations("membership.status");
  const tmem = useTranslations("membership");
  const tprogress = useTranslations("progress");
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      athletes.filter((row) =>
        row.profile.nombre_completo
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      ),
    [athletes, search]
  );

  if (athletes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 py-12 text-center">
        <p className="font-semibold">{t("emptyTitle")}</p>
        <p className="text-sm text-muted-foreground mt-2">
          {t("emptyDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-sm"
        />
        <p className="text-sm text-muted-foreground">
          {filtered.length} {t("athletesFound")}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-12 text-center">
          <p className="font-semibold">{t("emptyTitle")}</p>
          <p className="text-sm text-muted-foreground mt-2">{tc("noData")}</p>
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-2">
            {filtered.map((row) => (
              <AtletaMobileRow
                key={row.profile.id}
                row={row}
                locale={locale}
                gymTimezone={gymTimezone}
                expanded={expandedId === row.profile.id}
                onToggle={() =>
                  setExpandedId((current) =>
                    current === row.profile.id ? null : row.profile.id
                  )
                }
                t={t}
                ts={ts}
                tm={tm}
                tmem={tmem}
                tadmin={tadmin}
                tprogress={tprogress}
              />
            ))}
          </div>

          <div className="hidden md:grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((row) => {
              const status = getSocioDisplayStatus(
                row.profile,
                row.membresia,
                gymTimezone
              );

              return (
                <Card
                  key={row.profile.id}
                  className="border-white/10 bg-card/50 overflow-hidden"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <AthleteAvatar
                        fotoUrl={row.profile.foto_url}
                        seed={row.profile.id}
                        name={row.profile.nombre_completo}
                        className="h-12 w-12 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-base truncate">
                          {row.profile.nombre_completo}
                        </p>
                        {row.profile.telefono && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {row.profile.telefono}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <AtletaDetailBody
                      row={row}
                      locale={locale}
                      status={status}
                      t={t}
                      ts={ts}
                      tm={tm}
                      tmem={tmem}
                      tadmin={tadmin}
                      tprogress={tprogress}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
