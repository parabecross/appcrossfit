"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClassHistoryList } from "@/components/clases/class-history-list";
import type { AthleteClassHistoryItem } from "@/lib/queries/athlete-history";
import type { ClaseScore } from "@/types/database";

export function SocioClassHistory({
  items,
  locale,
  gymTimezone,
  title,
  description,
  emptyMessage,
  summary,
  scoresByClaseId,
  profileId,
  compact = false,
}: {
  items: AthleteClassHistoryItem[];
  locale: string;
  gymTimezone: string;
  title: string;
  description: string;
  emptyMessage: string;
  summary?: string;
  scoresByClaseId?: Map<string, ClaseScore>;
  profileId: string;
  compact?: boolean;
}) {
  return (
    <Card className={compact ? "border-0 bg-transparent shadow-none" : undefined}>
      {!compact && (
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {description}
          {summary ? (
            <span className="mt-1 block font-medium text-foreground/80">
              {summary}
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>
      )}
      <CardContent className={compact ? "p-0 pt-1" : undefined}>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ClassHistoryList
            items={items}
            locale={locale}
            profileId={profileId}
            gymTimezone={gymTimezone}
            scoresByClaseId={scoresByClaseId}
          />
        )}
      </CardContent>
    </Card>
  );
}
