import type {
  DashboardActivityEvent,
  InactiveAthleteAlert,
  WeeklySummaryData,
} from "@/lib/admin/dashboard-helpers";
import type { BirthdayAlert } from "@/lib/queries/birthdays";
import type { getKpis } from "@/lib/queries/memberships";
import {
  computeDemandStats,
  computeTrendStats,
} from "@/lib/queries/stats";
import type { AlertaMembresia, Clase } from "@/types/database";
import type { partitionMembershipAlerts } from "@/lib/admin/dashboard-helpers";

export interface AdminDashboardTodayClass extends Clase {
  cupo_ocupado: number;
}

export interface AdminDashboardEssentialData {
  today: string;
  boxName: string;
  executive: {
    classesToday: number;
    reservationsToday: number;
    attendanceToday: number;
    avgOccupancyToday: number;
    expiringSoon: number;
    pendingPayment: number;
  };
  boxStatus: {
    activeMembers: number;
    totalMembers: number;
    expired: number;
    expiringSoon: number;
    avgOccupancyToday: number;
    attendanceToday: number;
  };
  kpis: Awaited<ReturnType<typeof getKpis>>;
  alertas: AlertaMembresia[];
  membershipAlerts: ReturnType<typeof partitionMembershipAlerts>;
  todayClasses: AdminDashboardTodayClass[];
  lowOccupancyClasses: AdminDashboardTodayClass[];
  birthdayAlerts: BirthdayAlert[];
}

export interface AdminDashboardHeavyData {
  inactiveAthletesHigh: InactiveAthleteAlert[];
  athletesWithoutWeekBooking: { id: string; nombre: string }[];
  weeklySummary: WeeklySummaryData;
  recentPrs: Array<{
    id: string;
    ejercicio: string;
    valor: number;
    unidad: string;
    nombre: string;
    fecha: string;
  }>;
  recentSkills: Array<{
    id: string;
    skill: string;
    estado: string;
    nombre: string;
    at: string;
  }>;
  topConsistentAthletes: Array<{ name: string; frequency: number }>;
  charts: {
    demand: ReturnType<typeof computeDemandStats>;
    trend: ReturnType<typeof computeTrendStats>;
  };
  recentActivity: DashboardActivityEvent[];
  inactiveAthletesCount: number;
  recentPrsCount: number;
  attendanceRate: number | null;
  loadError: boolean;
}

export interface AdminDashboardData
  extends AdminDashboardEssentialData,
    Omit<
      AdminDashboardHeavyData,
      "loadError" | "inactiveAthletesCount" | "recentPrsCount" | "attendanceRate"
    > {
  executive: AdminDashboardEssentialData["executive"] & {
    recentPrsCount: number;
    inactiveAthletesCount: number;
  };
  boxStatus: AdminDashboardEssentialData["boxStatus"] & {
    attendanceRate: number | null;
  };
}
