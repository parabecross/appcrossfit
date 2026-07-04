import { Link } from "@/i18n/routing";
import {
  ExpiredMembersList,
  ExpiringMembersList,
} from "@/components/admin/dashboard-alerts";
import type { AdminDashboardTodayClass } from "@/lib/queries/admin-dashboard";
import type { AlertaMembresia } from "@/types/database";
import { CheckCircle2 } from "lucide-react";
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
    <div className={cn("rounded-xl px-4 py-3", borderClass)}>
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

export function DashboardCorePriorityAlerts({
  membershipAlerts,
  lowOccupancyClasses,
  pendingPayment,
  locale,
  boxName,
  labels,
}: {
  membershipAlerts: {
    vencidas: AlertaMembresia[];
    porVencer: AlertaMembresia[];
  };
  lowOccupancyClasses: AdminDashboardTodayClass[];
  pendingPayment: number;
  locale: string;
  boxName: string;
  labels: {
    title: string;
    priorityHigh: string;
    priorityMedium: string;
    expired: string;
    expiring: string;
    lowOccupancy: string;
    pendingPayment: string;
    emptyPremium: string;
  };
}) {
  const highCount =
    membershipAlerts.vencidas.length +
    membershipAlerts.porVencer.length +
    (pendingPayment > 0 ? 1 : 0);
  const mediumCount = lowOccupancyClasses.length;
  const total = highCount + mediumCount;

  return (
    <section className="rounded-2xl bg-white/[0.02] ring-1 ring-white/10 p-5 space-y-4">
      <p className="text-sm font-bold">{labels.title}</p>

      {total === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-green-500/[0.06] px-4 py-4">
          <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
          <p className="text-sm text-muted-foreground">{labels.emptyPremium}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(membershipAlerts.vencidas.length > 0 ||
            membershipAlerts.porVencer.length > 0 ||
            pendingPayment > 0) && (
            <PriorityGroup
              level="high"
              title={labels.priorityHigh}
              count={highCount}
              borderClass="bg-red-500/[0.04] ring-1 ring-red-500/15"
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
                {pendingPayment > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-400/90 mb-1.5">
                      {labels.pendingPayment}
                    </p>
                    <Link
                      href="/admin/usuarios"
                      className="text-sm hover:underline"
                    >
                      {pendingPayment}
                    </Link>
                  </div>
                )}
              </div>
            </PriorityGroup>
          )}

          {lowOccupancyClasses.length > 0 && (
            <PriorityGroup
              level="medium"
              title={labels.priorityMedium}
              count={mediumCount}
              borderClass="bg-orange-500/[0.04] ring-1 ring-orange-500/15"
            >
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
            </PriorityGroup>
          )}
        </div>
      )}
    </section>
  );
}
