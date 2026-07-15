import {
  Activity,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  DoorOpen,
  Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";

function HeroMetric({
  icon: Icon,
  label,
  value,
  hint,
  accent = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  accent?: "orange" | "green" | "red" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-xl px-3 py-3.5 sm:px-4 sm:py-4",
        "bg-white/[0.03] backdrop-blur-sm",
        accent === "red" && "ring-1 ring-red-500/20",
        accent === "orange" && "ring-1 ring-orange-500/20",
        accent === "green" && "ring-1 ring-green-500/15"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 mb-2",
          accent === "green" && "text-green-400",
          accent === "red" && "text-red-400",
          accent === "orange" && "text-orange-400",
          accent === "neutral" && "text-muted-foreground"
        )}
      />
      <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight leading-none">
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1.5 font-medium leading-snug">
        {label}
      </p>
      {hint ? (
        <p className="text-[11px] text-muted-foreground/80 mt-1 leading-snug">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function DashboardTodayHero({
  data,
  labels,
}: {
  data: {
    reservationsToday: number;
    attendanceToday: number;
    classesToday: number;
    avgOccupancyToday: number;
    availableSpotsToday: number;
    expiredMemberships: number;
    expiringMemberships: number;
    pendingPayment: number;
  };
  labels: {
    title: string;
    reservationsToday: string;
    attendanceToday: string;
    classesToday: string;
    avgOccupancy: string;
    availableSpots: string;
    membershipsAttention: string;
    membershipsHint: string;
    pendingPayment: string;
  };
}) {
  const membershipTotal =
    data.expiredMemberships + data.expiringMemberships;
  const membershipAccent =
    data.expiredMemberships > 0
      ? "red"
      : data.expiringMemberships > 0 || data.pendingPayment > 0
        ? "orange"
        : "neutral";

  return (
    <section className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-400/90">
        {labels.title}
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
        <HeroMetric
          icon={CalendarDays}
          label={labels.classesToday}
          value={data.classesToday}
        />
        <HeroMetric
          icon={ClipboardCheck}
          label={labels.reservationsToday}
          value={data.reservationsToday}
          accent="orange"
        />
        <HeroMetric
          icon={Activity}
          label={labels.attendanceToday}
          value={data.attendanceToday}
          accent="green"
        />
        <HeroMetric
          icon={DoorOpen}
          label={labels.availableSpots}
          value={data.availableSpotsToday}
        />
        <HeroMetric
          icon={Gauge}
          label={labels.avgOccupancy}
          value={
            data.classesToday > 0 ? `${data.avgOccupancyToday}%` : "—"
          }
        />
        <HeroMetric
          icon={CreditCard}
          label={labels.membershipsAttention}
          value={membershipTotal}
          hint={
            membershipTotal > 0 || data.pendingPayment > 0
              ? [
                  membershipTotal > 0 ? labels.membershipsHint : null,
                  data.pendingPayment > 0
                    ? `${labels.pendingPayment}: ${data.pendingPayment}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : undefined
          }
          accent={membershipAccent}
        />
      </div>
    </section>
  );
}
