import { Link } from "@/i18n/routing";
import {
  Activity,
  ArrowRight,
  Award,
  CalendarCheck,
  CreditCard,
  Dumbbell,
} from "lucide-react";
import type { DashboardActivityEvent } from "@/lib/admin/dashboard-helpers";
import { formatTime } from "@/lib/utils";

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

export function DashboardRecentActivityCompact({
  events,
  labels,
}: {
  events: DashboardActivityEvent[];
  labels: {
    title: string;
    empty: string;
    viewAll: string;
    types: Record<DashboardActivityEvent["type"], string>;
  };
}) {
  const recent = events.slice(0, 5);

  return (
    <section className="rounded-2xl bg-white/[0.02] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold">{labels.title}</p>
        {events.length > 0 && (
          <Link
            href="/admin/estadisticas"
            className="inline-flex items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors shrink-0"
          >
            {labels.viewAll}
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <ul className="space-y-1">
          {recent.map((e) => {
            const Icon = ICONS[e.type];
            return (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
                  <Icon className="h-3.5 w-3.5 text-orange-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{e.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {labels.types[e.type]}
                    {e.subtitle ? ` · ${e.subtitle}` : ""}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {eventTime(e.at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
