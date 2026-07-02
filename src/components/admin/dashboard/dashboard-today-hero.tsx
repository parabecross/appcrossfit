import {
  Activity,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
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
        "rounded-2xl px-4 py-5 md:px-5 md:py-6",
        "bg-white/[0.03] backdrop-blur-sm",
        accent === "red" && "ring-1 ring-red-500/20",
        accent === "orange" && "ring-1 ring-orange-500/20",
        accent === "green" && "ring-1 ring-green-500/15"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 mb-3",
          accent === "green" && "text-green-400",
          accent === "red" && "text-red-400",
          accent === "orange" && "text-orange-400",
          accent === "neutral" && "text-muted-foreground"
        )}
      />
      <p className="text-3xl md:text-4xl font-black tabular-nums tracking-tight leading-none">
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-2 font-medium">{label}</p>
      {hint ? (
        <p className="text-[11px] text-muted-foreground/80 mt-1">{hint}</p>
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
    expiredMemberships: number;
    expiringMemberships: number;
  };
  labels: {
    title: string;
    reservationsToday: string;
    attendanceToday: string;
    classesToday: string;
    membershipsAttention: string;
    membershipsHint: string;
  };
}) {
  const membershipTotal =
    data.expiredMemberships + data.expiringMemberships;
  const membershipAccent =
    data.expiredMemberships > 0
      ? "red"
      : data.expiringMemberships > 0
        ? "orange"
        : "neutral";

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-400/90">
          {labels.title}
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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
          icon={CalendarDays}
          label={labels.classesToday}
          value={data.classesToday}
        />
        <HeroMetric
          icon={CreditCard}
          label={labels.membershipsAttention}
          value={membershipTotal}
          hint={
            membershipTotal > 0 ? labels.membershipsHint : undefined
          }
          accent={membershipAccent}
        />
      </div>
    </section>
  );
}
