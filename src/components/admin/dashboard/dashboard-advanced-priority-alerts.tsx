import { Link } from "@/i18n/routing";
import type { InactiveAthleteAlert } from "@/lib/admin/dashboard-helpers";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

function PriorityGroup({
  level,
  title,
  count,
  children,
  borderClass,
}: {
  level: "high" | "medium" | "low";
  title: string;
  count: number;
  children: React.ReactNode;
  borderClass: string;
}) {
  if (count === 0) return null;
  return (
    <div className={cn("rounded-xl px-4 py-3", borderClass)}>
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
            level === "medium" && "bg-orange-500/20 text-orange-400",
            level === "low" && "bg-white/10 text-muted-foreground"
          )}
        >
          {title}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          ({count})
        </span>
      </div>
      {children}
    </div>
  );
}

export function DashboardAdvancedPriorityAlerts({
  inactiveAthletesHigh,
  athletesWithoutWeekBooking,
  labels,
  formatInactiveDays,
  advancedEnabled,
  loadError,
}: {
  inactiveAthletesHigh: InactiveAthleteAlert[];
  athletesWithoutWeekBooking: { id: string; nombre: string }[];
  labels: {
    priorityMedium: string;
    priorityLow: string;
    inactive: string;
    noWeekBooking: string;
    loadError: string;
  };
  formatInactiveDays: (days: number) => string;
  advancedEnabled: boolean;
  loadError?: boolean;
}) {
  if (!advancedEnabled) return null;

  if (loadError) {
    return (
      <section className="rounded-2xl bg-white/[0.02] ring-1 ring-white/10 p-5">
        <div className="flex items-center gap-3 rounded-xl bg-red-500/[0.06] px-4 py-4">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <p className="text-sm text-muted-foreground">{labels.loadError}</p>
        </div>
      </section>
    );
  }

  const advancedCount =
    inactiveAthletesHigh.length + athletesWithoutWeekBooking.length;

  if (advancedCount === 0) return null;

  return (
    <section className="rounded-2xl bg-white/[0.02] ring-1 ring-white/10 p-5 space-y-3">
      {inactiveAthletesHigh.length > 0 && (
        <PriorityGroup
          level="medium"
          title={labels.priorityMedium}
          count={inactiveAthletesHigh.length}
          borderClass="bg-orange-500/[0.04] ring-1 ring-orange-500/15"
        >
          <div>
            <p className="text-xs font-semibold text-orange-400/90 mb-1.5">
              {labels.inactive}
            </p>
            <div className="space-y-1.5">
              {inactiveAthletesHigh.slice(0, 5).map((a) => (
                <Link
                  key={a.profileId}
                  href={`/admin/usuarios/${a.profileId}`}
                  className="block text-sm hover:underline"
                >
                  {a.nombre} — {formatInactiveDays(a.daysSinceAttendance)}
                </Link>
              ))}
            </div>
          </div>
        </PriorityGroup>
      )}

      {athletesWithoutWeekBooking.length > 0 && (
        <PriorityGroup
          level="low"
          title={labels.priorityLow}
          count={athletesWithoutWeekBooking.length}
          borderClass="bg-black/20 ring-1 ring-white/10"
        >
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">
            {labels.noWeekBooking}
          </p>
          <div className="flex flex-wrap gap-2">
            {athletesWithoutWeekBooking.map((a) => (
              <Link
                key={a.id}
                href={`/admin/usuarios/${a.id}`}
                className="text-xs rounded-full border border-white/10 px-2.5 py-1 hover:border-orange-500/30"
              >
                {a.nombre}
              </Link>
            ))}
          </div>
        </PriorityGroup>
      )}
    </section>
  );
}
