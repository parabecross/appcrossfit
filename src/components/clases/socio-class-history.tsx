import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClassHistoryList } from "@/components/clases/class-history-list";
import { hasClassEnded } from "@/lib/clases/helpers";
import type { AthleteClassHistoryItem } from "@/lib/queries/athlete-history";

export function SocioClassHistory({
  items,
  locale,
  gymTimezone,
  title,
  description,
  emptyMessage,
  summary,
}: {
  items: AthleteClassHistoryItem[];
  locale: string;
  gymTimezone: string;
  title: string;
  description: string;
  emptyMessage: string;
  summary?: string;
}) {
  const pastItems = items.filter((r) =>
    hasClassEnded(r.clase.fecha, r.clase.hora_fin, gymTimezone)
  );

  return (
    <Card>
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
      <CardContent>
        {pastItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ClassHistoryList items={pastItems} locale={locale} />
        )}
      </CardContent>
    </Card>
  );
}
