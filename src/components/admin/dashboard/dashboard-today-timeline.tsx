import {
  Activity,
  Award,
  CalendarCheck,
  CreditCard,
  Dumbbell,
} from "lucide-react";
import { formatTime } from "@/lib/utils";
import type { DashboardActivityEvent } from "@/lib/admin/dashboard-helpers";
import { cn } from "@/lib/utils";

const ICONS = {
  reserva: CalendarCheck,
  asistencia: Activity,
  pr: Dumbbell,
  skill: Award,
  membresia: CreditCard,
} as const;

function eventTime(at: string): string {
  if (at.includes("T")) {
    return formatTime(at.slice(11, 16));
  }
  return "—";
}

export function DashboardTodayTimeline({
  events,
  labels,
}: {
  events: DashboardActivityEvent[];
  labels: {
    title: string;
    empty: string;
    types: Record<DashboardActivityEvent["type"], string>;
  };
}) {
  const sorted = [...events].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <p className="text-sm font-bold mb-4">{labels.title}</p>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="relative pl-4">
          <div
            className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-orange-500/40 via-white/10 to-transparent"
            aria-hidden
          />
          <ul className="space-y-0">
            {sorted.map((e, i) => {
              const Icon = ICONS[e.type];
              return (
                <li
                  key={e.id}
                  className={cn(
                    "relative flex gap-3 pb-5",
                    i === sorted.length - 1 && "pb-0"
                  )}
                >
                  <div className="relative z-10 flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border-2 border-orange-500/50 bg-background mt-1">
                    <Icon className="h-2.5 w-2.5 text-orange-400" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">
                        {e.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                        {eventTime(e.at)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {labels.types[e.type]}
                      {e.subtitle ? ` · ${e.subtitle}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
