"use client";

import { useTranslations } from "next-intl";
import { AthleteExpandableSection } from "@/components/socio/home/athlete-expandable-section";
import { SocioClassHistory } from "@/components/clases/socio-class-history";
import type { AthleteClassHistoryItem } from "@/lib/queries/athlete-history";
import type { ClaseScore } from "@/types/database";

export function AthleteHomeHistorySection({
  items,
  locale,
  gymTimezone,
  profileId,
  scoresByClaseId,
  summary,
}: {
  items: AthleteClassHistoryItem[];
  locale: string;
  gymTimezone: string;
  profileId: string;
  scoresByClaseId: Map<string, ClaseScore>;
  summary: string;
}) {
  const t = useTranslations("socioHome");
  const tcl = useTranslations("classes");

  return (
    <AthleteExpandableSection
      title={t("sections.historyTitle")}
      subtitle={summary}
      defaultOpen={false}
      expandLabel={t("sections.expand")}
      collapseLabel={t("sections.collapse")}
    >
      <SocioClassHistory
        items={items}
        locale={locale}
        gymTimezone={gymTimezone}
        title={t("sections.historyTitle")}
        description={tcl("historyDescription")}
        emptyMessage={tcl("noHistory")}
        scoresByClaseId={scoresByClaseId}
        profileId={profileId}
        compact
      />
    </AthleteExpandableSection>
  );
}
