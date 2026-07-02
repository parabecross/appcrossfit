"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DashboardTodayTimeline } from "@/components/admin/dashboard/dashboard-today-timeline";
import type { DashboardActivityEvent } from "@/lib/admin/dashboard-helpers";

export function ActivityFeedExplorer({
  events,
  today,
  locale,
  labels,
}: {
  events: DashboardActivityEvent[];
  today: string;
  locale: string;
  labels: {
    title: string;
    subtitle: string;
    empty: string;
    searchPlaceholder: string;
    noResults: string;
    today: string;
    yesterday: string;
    types: Record<DashboardActivityEvent["type"], string>;
  };
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.subtitle?.toLowerCase().includes(q) ||
        labels.types[e.type].toLowerCase().includes(q)
    );
  }, [events, labels.types, search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={labels.searchPlaceholder}
          className="pl-9 bg-black/30 border-white/10"
        />
      </div>

      {filtered.length === 0 && events.length > 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {labels.noResults}
        </p>
      ) : (
        <DashboardTodayTimeline
          events={filtered}
          today={today}
          locale={locale}
          hideHeader
          labels={{
            title: labels.title,
            subtitle: labels.subtitle,
            empty: labels.empty,
            today: labels.today,
            yesterday: labels.yesterday,
            types: labels.types,
          }}
        />
      )}
    </div>
  );
}
