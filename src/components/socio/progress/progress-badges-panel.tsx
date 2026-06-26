"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Award, Lock, Medal, Star } from "lucide-react";
import {
  computeBadges,
  getSkillBadgeState,
  isSkillBadgeKey,
  skillKeyFromBadgeKey,
  splitBadges,
  type BadgeInput,
} from "@/lib/progreso/badges";
import { cn } from "@/lib/utils";

export function ProgressBadgesPanel({
  input,
  compact = false,
}: {
  input: BadgeInput;
  compact?: boolean;
}) {
  const t = useTranslations("progress");

  const badges = useMemo(() => computeBadges(input), [input]);
  const { milestones, skills } = useMemo(() => splitBadges(badges), [badges]);

  const unlockedMilestones = milestones.filter((b) => b.unlocked);
  const unlockedSkills = skills.filter((b) => b.unlocked);

  return (
    <div className="space-y-4">
      {/* Skills — siempre visible, protagonismo CrossFit */}
      <div className="rounded-2xl border border-orange-500/15 bg-gradient-to-br from-orange-500/[0.06] to-transparent p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-orange-400 shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-orange-300/90">
                {t("badgesSection.skills")}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t("badgesSection.skillsSubtitle")}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-orange-500/15 border border-orange-500/25 px-2.5 py-1 text-[11px] font-bold tabular-nums text-orange-200">
            {unlockedSkills.length}/{skills.length}
          </span>
        </div>

        <div
          className={cn(
            "grid gap-2",
            compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
          )}
        >
          {skills.map((badge) => {
            if (!isSkillBadgeKey(badge.key)) return null;
            const skillKey = skillKeyFromBadgeKey(badge.key);
            const estado = getSkillBadgeState(input.skills, skillKey);
            const mastered = estado === "dominado";

            return (
              <BadgeChip
                key={badge.key}
                label={t(`badges.${badge.key}`)}
                unlocked={badge.unlocked}
                mastered={mastered}
                lockedLabel={t("badgesSection.locked")}
              />
            );
          })}
        </div>
      </div>

      {/* Hitos generales */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 md:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Medal className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("badgesSection.milestones")}
            </p>
          </div>
          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
            {unlockedMilestones.length}/{milestones.length}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {milestones.map((badge) => (
              <BadgeChip
                key={badge.key}
                label={t(`badges.${badge.key}`)}
                unlocked={badge.unlocked}
                lockedLabel={t("badgesSection.locked")}
              />
            ))}
          </div>
      </div>
    </div>
  );
}

function BadgeChip({
  label,
  unlocked,
  mastered = false,
  lockedLabel,
}: {
  label: string;
  unlocked: boolean;
  mastered?: boolean;
  lockedLabel: string;
}) {
  if (!unlocked) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5",
          "opacity-50"
        )}
        title={lockedLabel}
      >
        <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11px] font-medium text-muted-foreground line-clamp-2 leading-snug">
          {label}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-all",
        mastered
          ? "border-orange-400/40 bg-gradient-to-r from-orange-500/25 to-red-500/15 shadow-[0_0_16px_-6px_rgba(249,115,22,0.4)]"
          : "border-orange-500/25 bg-gradient-to-r from-orange-500/15 to-red-500/5"
      )}
    >
      {mastered ? (
        <Star className="h-3.5 w-3.5 text-orange-300 shrink-0 fill-orange-400/30" />
      ) : (
        <Award className="h-3.5 w-3.5 text-orange-400 shrink-0" />
      )}
      <span className="text-[11px] font-semibold text-orange-50 line-clamp-2 leading-snug">
        {label}
      </span>
    </div>
  );
}
