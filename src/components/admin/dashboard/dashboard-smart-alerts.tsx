import { Link } from "@/i18n/routing";
import {
  ExpiredMembersList,
  ExpiringMembersList,
} from "@/components/admin/dashboard-alerts";
import type { InactiveAthleteAlert } from "@/lib/admin/dashboard-helpers";
import type { AlertaMembresia } from "@/types/database";

function AlertSection({
  title,
  count,
  children,
  borderClass,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  borderClass: string;
}) {
  if (count === 0) return null;
  return (
    <div className={`rounded-xl border px-4 py-3 ${borderClass}`}>
      <p className="text-xs font-bold uppercase tracking-wider mb-2">
        {title} ({count})
      </p>
      {children}
    </div>
  );
}

export function DashboardSmartAlerts({
  membershipAlerts,
  inactiveAthletes,
  athletesWithoutWeekBooking,
  lowOccupancyCount,
  locale,
  boxName,
  labels,
  formatInactiveDays,
}: {
  membershipAlerts: {
    vencidas: AlertaMembresia[];
    porVencer: AlertaMembresia[];
  };
  inactiveAthletes: InactiveAthleteAlert[];
  athletesWithoutWeekBooking: { id: string; nombre: string }[];
  lowOccupancyCount: number;
  locale: string;
  boxName: string;
  labels: {
    title: string;
    expired: string;
    expiring: string;
    inactive: string;
    inactiveDays: string;
    noWeekBooking: string;
    lowOccupancy: string;
    lowOccupancyDetail: string;
    empty: string;
  };
  formatInactiveDays: (days: number) => string;
}) {
  const total =
    membershipAlerts.vencidas.length +
    membershipAlerts.porVencer.length +
    inactiveAthletes.length +
    athletesWithoutWeekBooking.length +
    (lowOccupancyCount > 0 ? 1 : 0);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
      <p className="text-sm font-bold">{labels.title}</p>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="space-y-3">
          {membershipAlerts.vencidas.length > 0 && (
            <AlertSection
              title={labels.expired}
              count={membershipAlerts.vencidas.length}
              borderClass="border-red-500/20 bg-red-500/5"
            >
              <ExpiredMembersList
                items={membershipAlerts.vencidas.slice(0, 5)}
                locale={locale}
                boxName={boxName}
              />
            </AlertSection>
          )}

          {membershipAlerts.porVencer.length > 0 && (
            <AlertSection
              title={labels.expiring}
              count={membershipAlerts.porVencer.length}
              borderClass="border-orange-500/20 bg-orange-500/5"
            >
              <ExpiringMembersList
                items={membershipAlerts.porVencer.slice(0, 5)}
                locale={locale}
                boxName={boxName}
              />
            </AlertSection>
          )}

          {inactiveAthletes.length > 0 && (
            <AlertSection
              title={labels.inactive}
              count={inactiveAthletes.length}
              borderClass="border-white/10 bg-black/20"
            >
              <div className="space-y-2">
                {inactiveAthletes.slice(0, 5).map((a) => (
                  <Link
                    key={a.profileId}
                    href={`/admin/usuarios/${a.profileId}`}
                    className="block text-sm hover:underline"
                  >
                    {a.nombre} — {formatInactiveDays(a.daysSinceAttendance)}
                  </Link>
                ))}
              </div>
            </AlertSection>
          )}

          {athletesWithoutWeekBooking.length > 0 && (
            <AlertSection
              title={labels.noWeekBooking}
              count={athletesWithoutWeekBooking.length}
              borderClass="border-white/10 bg-black/20"
            >
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
            </AlertSection>
          )}

          {lowOccupancyCount > 0 && (
            <AlertSection
              title={labels.lowOccupancy}
              count={lowOccupancyCount}
              borderClass="border-orange-500/20 bg-orange-500/5"
            >
              <p className="text-sm text-muted-foreground">
                {labels.lowOccupancyDetail}
              </p>
            </AlertSection>
          )}
        </div>
      )}
    </div>
  );
}
