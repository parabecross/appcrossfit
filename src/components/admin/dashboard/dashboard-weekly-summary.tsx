import {
  CalendarCheck,
  CreditCard,
  Dumbbell,
  Target,
  TrendingUp,
} from "lucide-react";
import type { WeeklySummaryData } from "@/lib/admin/dashboard-helpers";
import { cn } from "@/lib/utils";

function SummaryRow({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail?: string;
  accent?: "green" | "red" | "orange" | "neutral";
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-black/20 px-4 py-3">
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 mt-0.5",
          accent === "green" && "text-green-400",
          accent === "red" && "text-red-400",
          accent === "orange" && "text-orange-400",
          (!accent || accent === "neutral") && "text-muted-foreground"
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold mt-0.5">{value}</p>
        {detail ? (
          <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}

export function DashboardWeeklySummary({
  data,
  labels,
}: {
  data: WeeklySummaryData;
  labels: {
    title: string;
    subtitle: string;
    attendance: string;
    attendanceVsLast: string;
    topClass: string;
    topClassBookings: string;
    prs: string;
    goals: string;
    memberships: string;
    noTopClass: string;
    deltaUp: string;
    deltaDown: string;
    deltaSame: string;
  };
}) {
  const deltaLabel =
    data.attendanceDelta > 0
      ? labels.deltaUp.replace("{delta}", String(data.attendanceDelta))
      : data.attendanceDelta < 0
        ? labels.deltaDown.replace(
            "{delta}",
            String(Math.abs(data.attendanceDelta))
          )
        : labels.deltaSame;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 md:p-6 space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-400/90">
          {labels.title}
        </p>
        <p className="text-sm text-muted-foreground mt-1">{labels.subtitle}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryRow
          icon={TrendingUp}
          label={labels.attendance}
          value={String(data.attendanceThisWeek)}
          detail={`${labels.attendanceVsLast.replace("{last}", String(data.attendanceLastWeek))} · ${deltaLabel}`}
          accent="orange"
        />
        <SummaryRow
          icon={CalendarCheck}
          label={labels.topClass}
          value={data.topClassName ?? labels.noTopClass}
          detail={
            data.topClassBookings > 0
              ? labels.topClassBookings.replace(
                  "{count}",
                  String(data.topClassBookings)
                )
              : undefined
          }
        />
        <SummaryRow
          icon={Dumbbell}
          label={labels.prs}
          value={String(data.prsThisWeek)}
          accent={data.prsThisWeek > 0 ? "green" : "neutral"}
        />
        <SummaryRow
          icon={Target}
          label={labels.goals}
          value={String(data.goalsCompleted)}
          accent={data.goalsCompleted > 0 ? "green" : "neutral"}
        />
        <SummaryRow
          icon={CreditCard}
          label={labels.memberships}
          value={String(data.membershipsRenewed)}
          accent={data.membershipsRenewed > 0 ? "orange" : "neutral"}
        />
      </div>
    </section>
  );
}
