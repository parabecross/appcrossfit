"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Award,
  CalendarDays,
  Dumbbell,
  Flame,
  Medal,
  Percent,
  Target,
  Trophy,
} from "lucide-react";
import { ProgressStatCard } from "@/components/socio/progress/progress-stat-card";
import {
  computeBadges,
  countUnlockedSkillBadges,
  SKILL_BADGE_KEYS,
} from "@/lib/progreso/badges";
import { countAchievedSkills, formatPrValue } from "@/lib/progreso/helpers";
import { SKILL_KEYS } from "@/lib/progreso/constants";
import type {
  AtletaObjetivo,
  AtletaPrMarca,
  AtletaSkill,
} from "@/types/database";
import type { AttendanceStats } from "@/lib/progreso/attendance";

export function ProgressDashboard({
  marcas,
  skills,
  objetivos,
  activeGoal,
  attendance,
}: {
  marcas: AtletaPrMarca[];
  skills: AtletaSkill[];
  objetivos: AtletaObjetivo[];
  activeGoal: AtletaObjetivo | null;
  attendance: AttendanceStats & { attendanceRate: number | null };
}) {
  const t = useTranslations("progress");

  const latestRecord = useMemo(() => {
    if (marcas.length === 0) return null;
    return [...marcas].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  }, [marcas]);

  const achievedSkills = countAchievedSkills(skills);
  const badges = useMemo(
    () =>
      computeBadges({
        marcas,
        skills,
        objetivos,
        totalClasses: attendance.totalClasses,
        uniqueTrainingDays: attendance.uniqueTrainingDays,
      }),
    [marcas, skills, objetivos, attendance]
  );
  const unlockedBadges = countUnlockedSkillBadges(badges);

  const attendanceLabel =
    attendance.attendanceRate !== null
      ? `${attendance.attendanceRate}%`
      : t("noData");

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <ProgressStatCard
        icon={Flame}
        label={t("dashboard.streak")}
        value={
          attendance.streak > 0
            ? t("dashboard.streakValue", { count: attendance.streak })
            : t("dashboard.noStreak")
        }
        hint={t("dashboard.streakHint")}
        accent="red"
      />
      <ProgressStatCard
        icon={CalendarDays}
        label={t("dashboard.classesMonth")}
        value={String(attendance.classesThisMonth)}
        hint={t("dashboard.classesMonthHint")}
      />
      <ProgressStatCard
        icon={Percent}
        label={t("dashboard.attendanceRate")}
        value={attendanceLabel}
        hint={t("dashboard.attendanceRateHint")}
      />
      <ProgressStatCard
        icon={Trophy}
        label={t("dashboard.totalClasses")}
        value={String(attendance.totalClasses)}
        hint={t("dashboard.totalClassesHint")}
      />
      <ProgressStatCard
        icon={Dumbbell}
        label={t("dashboard.prsLogged")}
        value={String(marcas.length)}
        hint={
          latestRecord
            ? `${t(`exercises.${latestRecord.ejercicio}`)} · ${formatPrValue(latestRecord.valor, latestRecord.unidad)}`
            : t("noPrsYet")
        }
      />
      <ProgressStatCard
        icon={Award}
        label={t("skillsAchieved")}
        value={`${achievedSkills}/${SKILL_KEYS.length}`}
        hint={t("dashboard.skillsHint")}
      />
      <ProgressStatCard
        icon={Target}
        label={t("dashboard.activeGoal")}
        value={activeGoal?.nombre ?? t("dashboard.noActiveGoal")}
        hint={activeGoal ? t("dashboard.coachGoalActive") : undefined}
        accent="red"
      />
      <ProgressStatCard
        icon={Medal}
        label={t("dashboard.badges")}
        value={t("dashboard.skillBadgesValue", {
          unlocked: unlockedBadges,
          total: SKILL_BADGE_KEYS.length,
        })}
        hint={t("dashboard.skillBadgesHint")}
      />
    </div>
  );
}
