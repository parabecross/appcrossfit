import {
  AlertTriangle,
  Clock,
  Percent,
  UserCheck,
  Users,
  Activity,
} from "lucide-react";
import { DashboardMetric } from "@/components/admin/dashboard/dashboard-metric";

export function DashboardBoxStatus({
  data,
  labels,
}: {
  data: {
    activeMembers: number;
    totalMembers: number;
    expired: number;
    expiringSoon: number;
    avgOccupancyToday: number;
    attendanceToday: number;
    attendanceRate: number | null;
  };
  labels: {
    title: string;
    subtitle: string;
    activeMembers: string;
    totalMembers: string;
    expired: string;
    expiringSoon: string;
    occupancy: string;
    attendanceToday: string;
    attendanceRate: string;
    noData: string;
  };
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 md:p-6 space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-400/90">
          {labels.title}
        </p>
        <p className="text-sm text-muted-foreground mt-1">{labels.subtitle}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <DashboardMetric
          icon={UserCheck}
          label={labels.activeMembers}
          value={data.activeMembers}
          accent="green"
        />
        <DashboardMetric
          icon={Users}
          label={labels.totalMembers}
          value={data.totalMembers}
        />
        <DashboardMetric
          icon={Percent}
          label={labels.occupancy}
          value={`${data.avgOccupancyToday}%`}
          accent="orange"
        />
        <DashboardMetric
          icon={Activity}
          label={labels.attendanceToday}
          value={data.attendanceToday}
          accent="green"
        />
        <DashboardMetric
          icon={AlertTriangle}
          label={labels.expired}
          value={data.expired}
          accent={data.expired > 0 ? "red" : "neutral"}
        />
        <DashboardMetric
          icon={Clock}
          label={labels.expiringSoon}
          value={data.expiringSoon}
          accent={data.expiringSoon > 0 ? "orange" : "neutral"}
        />
      </div>
      <p className="text-xs text-muted-foreground border-t border-white/5 pt-3">
        {labels.attendanceRate}:{" "}
        {data.attendanceRate !== null
          ? `${data.attendanceRate}%`
          : labels.noData}
      </p>
    </section>
  );
}
