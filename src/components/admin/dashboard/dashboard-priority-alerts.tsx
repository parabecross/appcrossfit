import { Link } from "@/i18n/routing";
import {
  ExpiredMembersList,
  ExpiringMembersList,
} from "@/components/admin/dashboard-alerts";
import type { InactiveAthleteAlert } from "@/lib/admin/dashboard-helpers";
import type { AdminDashboardTodayClass } from "@/lib/queries/admin-dashboard";
import type { AlertaMembresia } from "@/types/database";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/utils";

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
    <div className={cn("rounded-xl border px-4 py-3", borderClass)}>
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
            level === "high" && "bg-red-500/20 text-red-400",
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

export function DashboardPriorityAlerts({
  membershipAlerts,
  inactiveAthletesHigh,
  athletesWithoutWeekBooking,
  lowOccupancyClasses,
  locale,
  boxName,
  labels,
  formatInactiveDays,
}: {
  membershipAlerts: {
    vencidas: AlertaMembresia[];
    porVencer: AlertaMembresia[];
  };
  inactiveAthletesHigh: InactiveAthleteAlert[];
  athletesWithoutWeekBooking: { id: string; nombre: string }[];
  lowOccupancyClasses: AdminDashboardTodayClass[];
  locale: string;
  boxName: string;
  labels: {
    title: string;
    priorityHigh: string;
    priorityMedium: string;
    priorityLow: string;
    expired: string;
    expiring: string;
    inactive: string;
    noWeekBooking: string;
    lowOccupancy: string;
    empty: string;
  };
  formatInactiveDays: (days: number) => string;
}) {
  const highCount =
    membershipAlerts.vencidas.length + inactiveAthletesHigh.length;
  const mediumCount =
    membershipAlerts.porVencer.length + lowOccupancyClasses.length;
  const lowCount = athletesWithoutWeekBooking.length;
  const total = highCount + mediumCount + lowCount;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
      <p className="text-sm font-bold">{labels.title}</p>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="space-y-3">
          {(membershipAlerts.vencidas.length > 0 ||
            inactiveAthletesHigh.length > 0) && (
            <PriorityGroup
              level="high"
              title={labels.priorityHigh}
              count={highCount}
              borderClass="border-red-500/20 bg-red-500/[0.04]"
            >
              <div className="space-y-3">
                {membershipAlerts.vencidas.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-400/90 mb-1.5">
                      {labels.expired}
                    </p>
                    <ExpiredMembersList
                      items={membershipAlerts.vencidas.slice(0, 5)}
                      locale={locale}
                      boxName={boxName}
                    />
                  </div>
                )}
                {inactiveAthletesHigh.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-400/90 mb-1.5">
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
                )}
              </div>
            </PriorityGroup>
          )}

          {(membershipAlerts.porVencer.length > 0 ||
            lowOccupancyClasses.length > 0) && (
            <PriorityGroup
              level="medium"
              title={labels.priorityMedium}
              count={mediumCount}
              borderClass="border-orange-500/20 bg-orange-500/[0.04]"
            >
              <div className="space-y-3">
                {membershipAlerts.porVencer.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-orange-400/90 mb-1.5">
                      {labels.expiring}
                    </p>
                    <ExpiringMembersList
                      items={membershipAlerts.porVencer.slice(0, 5)}
                      locale={locale}
                      boxName={boxName}
                    />
                  </div>
                )}
                {lowOccupancyClasses.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-orange-400/90 mb-1.5">
                      {labels.lowOccupancy}
                    </p>
                    <div className="space-y-1">
                      {lowOccupancyClasses.slice(0, 4).map((c) => (
                        <p key={c.id} className="text-sm text-muted-foreground">
                          {c.nombre} · {formatTime(c.hora_inicio)} —{" "}
                          {c.cupo_ocupado}/{c.cupo_maximo}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </PriorityGroup>
          )}

          {athletesWithoutWeekBooking.length > 0 && (
            <PriorityGroup
              level="low"
              title={labels.priorityLow}
              count={lowCount}
              borderClass="border-white/10 bg-black/20"
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
        </div>
      )}
    </section>
  );
}
