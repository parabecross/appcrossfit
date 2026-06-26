import {
  Activity,
  Award,
  CalendarCheck,
  CreditCard,
  Dumbbell,
} from "lucide-react";
import { formatCompactDate } from "@/lib/utils";
import type { DashboardActivityEvent } from "@/lib/admin/dashboard-helpers";

const ICONS = {
  reserva: CalendarCheck,
  asistencia: Activity,
  pr: Dumbbell,
  skill: Award,
  membresia: CreditCard,
} as const;

export function DashboardRecentActivity({
  events,
  locale,
  labels,
}: {
  events: DashboardActivityEvent[];
  locale: string;
  labels: {
    title: string;
    empty: string;
    types: Record<DashboardActivityEvent["type"], string>;
  };
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
      <p className="text-sm font-bold">{labels.title}</p>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {events.map((e) => {
            const Icon = ICONS[e.type];
            return (
              <div
                key={e.id}
                className="flex gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5"
              >
                <Icon className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {labels.types[e.type]}
                    {e.subtitle ? ` · ${e.subtitle}` : ""}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {formatCompactDate(e.at.slice(0, 10), locale)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
