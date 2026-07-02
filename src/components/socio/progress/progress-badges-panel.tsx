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

export function ProgressBadgesPanel({ input }: { input: BadgeInput }) {
  const t = useTranslations("progress");

  const badges = useMemo(() => computeBadges(input), [input]);
  const { milestones, skills } = useMemo(() => splitBadges(badges), [badges]);

  const unlockedMilestones = milestones.filter((b) => b.unlocked);
  const unlockedSkills = skills.filter((b) => b.unlocked);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Award className="h-3.5 w-3.5 text-orange-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-300/90">
                {t("badgesSection.skills")}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {t("badgesSection.skillsSubtitle")}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-md bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-orange-200">
            {unlockedSkills.length}/{skills.length}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
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

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Medal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t("badgesSection.milestones")}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {t("badgesSection.milestonesSubtitle")}
              </p>
            </div>
          </div>
          <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {unlockedMilestones.length}/{milestones.length}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
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
        className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-black/20 px-2 py-1.5 opacity-45"
        title={lockedLabel}
      >
        <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-[10px] font-medium text-muted-foreground line-clamp-2 leading-snug">
          {label}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2 py-1.5",
        mastered
          ? "border-orange-400/35 bg-orange-500/15"
          : "border-orange-500/20 bg-orange-500/10"
      )}
    >
      {mastered ? (
        <Star className="h-3 w-3 text-orange-300 shrink-0 fill-orange-400/30" />
      ) : (
        <Award className="h-3 w-3 text-orange-400 shrink-0" />
      )}
      <span className="text-[10px] font-semibold text-orange-50 line-clamp-2 leading-snug">
        {label}
      </span>
    </div>
  );
}
