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
  embedded = false,
  compact = false,
}: {
  data: WeeklySummaryData;
  labels: {
    title: string;
    subtitle: string;
    attendance: string;
    attendanceDetail: string;
    topClass: string;
    topClassBookingsDetail?: string;
    prs: string;
    goals: string;
    memberships: string;
    noTopClass: string;
  };
  embedded?: boolean;
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        embedded
          ? "space-y-3"
          : "rounded-2xl border border-white/10 bg-white/[0.02] p-5 md:p-6 space-y-4"
      )}
    >
      {!embedded && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-400/90">
            {labels.title}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{labels.subtitle}</p>
        </div>
      )}
      <div
        className={cn(
          "grid gap-3",
          compact ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3"
        )}
      >
        <SummaryRow
          icon={TrendingUp}
          label={labels.attendance}
          value={String(data.attendanceThisWeek)}
          detail={labels.attendanceDetail}
          accent="orange"
        />
        <SummaryRow
          icon={CalendarCheck}
          label={labels.topClass}
          value={data.topClassName ?? labels.noTopClass}
          detail={labels.topClassBookingsDetail}
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
