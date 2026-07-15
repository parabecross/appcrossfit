import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CalendarPlus } from "lucide-react";
import { formatTime, cn } from "@/lib/utils";
import {
  filterLowOccupancyClasses,
  getCupoStatus,
} from "@/lib/admin/dashboard-helpers";
import type { AdminDashboardTodayClass } from "@/lib/queries/admin-dashboard";

const MAX_CLASSES = 6;

export function DashboardUpcomingClasses({
  classes,
  labels,
}: {
  classes: AdminDashboardTodayClass[];
  labels: {
    title: string;
    empty: string;
    createClass: string;
    viewCalendar: string;
    cupo: string;
    available: string;
    lowOccupancyHint: string;
    status: {
      available: string;
      almost_full: string;
      full: string;
    };
  };
}) {
  const visible = classes.slice(0, MAX_CLASSES);
  const hasMore = classes.length > MAX_CLASSES;
  const lowIds = new Set(
    filterLowOccupancyClasses(classes).map((c) => c.id)
  );

  if (classes.length === 0) {
    return (
      <section className="rounded-2xl bg-white/[0.02] p-5 space-y-4">
        <p className="text-sm font-bold">{labels.title}</p>
        <div className="rounded-xl bg-black/20 px-4 py-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">{labels.empty}</p>
          <Link
            href="/admin/clases"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-500/15 text-orange-400 px-4 py-2 text-sm font-semibold hover:bg-orange-500/25 transition-colors"
          >
            <CalendarPlus className="h-4 w-4" />
            {labels.createClass}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white/[0.02] p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold">{labels.title}</p>
        <Link
          href="/admin/clases"
          className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors shrink-0"
        >
          {labels.viewCalendar}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-2">
        {visible.map((c) => {
          const occupied = c.cupo_ocupado ?? 0;
          const available = Math.max(0, c.cupo_maximo - occupied);
          const status = getCupoStatus(occupied, c.cupo_maximo);
          const isLow = lowIds.has(c.id);
          const badgeVariant =
            status === "full"
              ? "destructive"
              : status === "almost_full"
                ? "warning"
                : isLow
                  ? "secondary"
                  : "success";

          return (
            <Link
              key={c.id}
              href="/admin/clases"
              className={cn(
                "flex flex-col gap-2 rounded-xl bg-black/20 px-4 py-3 hover:bg-black/30 transition-colors sm:flex-row sm:items-center sm:justify-between min-h-11",
                status === "full" && "ring-1 ring-red-500/25",
                status === "almost_full" && "ring-1 ring-orange-500/20",
                isLow && status === "available" && "ring-1 ring-white/10"
              )}
            >
              <div className="min-w-0">
                <p className="font-semibold truncate">{c.nombre}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatTime(c.hora_inicio)}
                  {c.coach_nombre ? ` · ${c.coach_nombre}` : ""}
                  {isLow && status === "available"
                    ? ` · ${labels.lowOccupancyHint}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {labels.cupo}: {occupied}/{c.cupo_maximo}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {labels.available}: {available}
                </span>
                <Badge variant={badgeVariant}>{labels.status[status]}</Badge>
              </div>
            </Link>
          );
        })}
      </div>
      {hasMore && (
        <p className="text-xs text-muted-foreground text-center pt-1">
          +{classes.length - MAX_CLASSES}
        </p>
      )}
    </section>
  );
}
