import {
  Activity,
  CalendarDays,
  ClipboardCheck,
  Percent,
  Clock,
  AlertCircle,
  Dumbbell,
  UserX,
} from "lucide-react";
import { DashboardMetric } from "@/components/admin/dashboard/dashboard-metric";
import type { AdminDashboardData } from "@/lib/queries/admin-dashboard";

export function DashboardExecutiveSummary({
  data,
  labels,
}: {
  data: AdminDashboardData["executive"];
  labels: {
    title: string;
    classesToday: string;
    reservationsToday: string;
    attendanceToday: string;
    avgOccupancy: string;
    expiringSoon: string;
    pendingPayment: string;
    recentPrs: string;
    inactiveAthletes: string;
  };
}) {
  return (
    <section className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/[0.08] via-transparent to-red-500/[0.04] p-5 md:p-6 space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-400/90">
          {labels.title}
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DashboardMetric
          icon={CalendarDays}
          label={labels.classesToday}
          value={data.classesToday}
          accent="orange"
        />
        <DashboardMetric
          icon={ClipboardCheck}
          label={labels.reservationsToday}
          value={data.reservationsToday}
        />
        <DashboardMetric
          icon={Activity}
          label={labels.attendanceToday}
          value={data.attendanceToday}
          accent="green"
        />
        <DashboardMetric
          icon={Percent}
          label={labels.avgOccupancy}
          value={`${data.avgOccupancyToday}%`}
        />
        <DashboardMetric
          icon={Clock}
          label={labels.expiringSoon}
          value={data.expiringSoon}
          accent="orange"
        />
        <DashboardMetric
          icon={AlertCircle}
          label={labels.pendingPayment}
          value={data.pendingPayment}
          accent={data.pendingPayment > 0 ? "red" : "neutral"}
        />
        <DashboardMetric
          icon={Dumbbell}
          label={labels.recentPrs}
          value={data.recentPrsCount}
          accent={data.recentPrsCount > 0 ? "green" : "neutral"}
        />
        <DashboardMetric
          icon={UserX}
          label={labels.inactiveAthletes}
          value={data.inactiveAthletesCount}
          accent={data.inactiveAthletesCount > 0 ? "red" : "neutral"}
        />
      </div>
    </section>
  );
}
