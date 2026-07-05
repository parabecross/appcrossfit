"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Award, Lock, Medal, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  computeBadges,
  getSkillBadgeState,
  isSkillBadgeKey,
  skillKeyFromBadgeKey,
  splitBadges,
  type BadgeInput,
} from "@/lib/progreso/badges";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 3;

export function ProgressBadgesSummary({ input }: { input: BadgeInput }) {
  const t = useTranslations("progress");
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [milestonesOpen, setMilestonesOpen] = useState(false);

  const badges = useMemo(() => computeBadges(input), [input]);
  const { milestones, skills } = useMemo(() => splitBadges(badges), [badges]);

  const unlockedSkills = skills.filter((b) => b.unlocked);
  const unlockedMilestones = milestones.filter((b) => b.unlocked);
  const previewSkills = unlockedSkills.slice(0, PREVIEW_LIMIT);
  const previewMilestones = unlockedMilestones.slice(0, PREVIEW_LIMIT);

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        <SummaryCard
          icon={Award}
          iconClassName="text-orange-400"
          title={t("badgesSection.skills")}
          count={`${unlockedSkills.length}/${skills.length}`}
          preview={previewSkills.map((badge) => {
            if (!isSkillBadgeKey(badge.key)) return null;
            const skillKey = skillKeyFromBadgeKey(badge.key);
            const estado = getSkillBadgeState(input.skills, skillKey);
            return (
              <BadgeChip
                key={badge.key}
                label={t(`badges.${badge.key}`)}
                unlocked
                mastered={estado === "dominado"}
              />
            );
          })}
          emptyLabel={t("expediente.noBadgesYet")}
          viewAllLabel={t("expediente.viewAllBadges")}
          onViewAll={() => setSkillsOpen(true)}
          hasMore={unlockedSkills.length > PREVIEW_LIMIT}
        />

        <SummaryCard
          icon={Medal}
          title={t("badgesSection.milestones")}
          count={`${unlockedMilestones.length}/${milestones.length}`}
          preview={previewMilestones.map((badge) => (
            <BadgeChip
              key={badge.key}
              label={t(`badges.${badge.key}`)}
              unlocked
            />
          ))}
          emptyLabel={t("expediente.noAchievementsYet")}
          viewAllLabel={t("expediente.viewAllAchievements")}
          onViewAll={() => setMilestonesOpen(true)}
          hasMore={unlockedMilestones.length > PREVIEW_LIMIT}
        />
      </div>

      <Dialog open={skillsOpen} onOpenChange={setSkillsOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("expediente.badgesDialogTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            {t("badgesSection.skillsSubtitle")}
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {skills.map((badge) => {
              if (!isSkillBadgeKey(badge.key)) return null;
              const skillKey = skillKeyFromBadgeKey(badge.key);
              const estado = getSkillBadgeState(input.skills, skillKey);
              return (
                <BadgeChip
                  key={badge.key}
                  label={t(`badges.${badge.key}`)}
                  unlocked={badge.unlocked}
                  mastered={estado === "dominado"}
                  lockedLabel={t("badgesSection.locked")}
                />
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={milestonesOpen} onOpenChange={setMilestonesOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("expediente.achievementsDialogTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            {t("badgesSection.milestonesSubtitle")}
          </p>
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
        </DialogContent>
      </Dialog>
    </>
  );
}

function SummaryCard({
  icon: Icon,
  iconClassName,
  title,
  count,
  preview,
  emptyLabel,
  viewAllLabel,
  onViewAll,
  hasMore,
}: {
  icon: typeof Award;
  iconClassName?: string;
  title: string;
  count: string;
  preview: React.ReactNode[];
  emptyLabel: string;
  viewAllLabel: string;
  onViewAll: () => void;
  hasMore: boolean;
}) {
  const hasUnlocked = preview.some(Boolean);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={cn("h-3.5 w-3.5 shrink-0", iconClassName)} />
          <p className="text-[10px] font-bold uppercase tracking-wider truncate">
            {title}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
          {count}
        </span>
      </div>

      {hasUnlocked ? (
        <div className="flex flex-wrap gap-1">{preview}</div>
      ) : (
        <p className="text-[10px] text-muted-foreground">{emptyLabel}</p>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-full text-[10px] text-orange-400 hover:text-orange-300"
        onClick={onViewAll}
      >
        {hasMore ? `${viewAllLabel} (${count})` : viewAllLabel}
      </Button>
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
  lockedLabel?: string;
}) {
  if (!unlocked) {
    return (
      <div
        className="flex items-center gap-1 rounded-md border border-white/5 bg-black/20 px-1.5 py-1 opacity-45"
        title={lockedLabel}
      >
        <Lock className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
        <span className="text-[9px] font-medium text-muted-foreground line-clamp-2 leading-snug">
          {label}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-md border px-1.5 py-1",
        mastered
          ? "border-orange-400/35 bg-orange-500/15"
          : "border-orange-500/20 bg-orange-500/10"
      )}
    >
      {mastered ? (
        <Star className="h-2.5 w-2.5 text-orange-300 shrink-0 fill-orange-400/30" />
      ) : (
        <Award className="h-2.5 w-2.5 text-orange-400 shrink-0" />
      )}
      <span className="text-[9px] font-semibold text-orange-50 line-clamp-2 leading-snug">
        {label}
      </span>
    </div>
  );
}
