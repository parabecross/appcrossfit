import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/utils";
import { getCupoStatus } from "@/lib/admin/dashboard-helpers";
import type { AdminDashboardTodayClass } from "@/lib/queries/admin-dashboard";

export function DashboardUpcomingClasses({
  classes,
  labels,
}: {
  classes: AdminDashboardTodayClass[];
  labels: {
    title: string;
    empty: string;
    cupo: string;
    status: {
      available: string;
      almost_full: string;
      full: string;
    };
  };
}) {
  if (classes.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <p className="text-sm font-bold">{labels.title}</p>
        <p className="text-sm text-muted-foreground mt-3">{labels.empty}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
      <p className="text-sm font-bold">{labels.title}</p>
      <div className="space-y-2">
        {classes.map((c) => {
          const occupied = c.cupo_ocupado ?? 0;
          const status = getCupoStatus(occupied, c.cupo_maximo);
          const badgeVariant =
            status === "full"
              ? "destructive"
              : status === "almost_full"
                ? "warning"
                : "success";

          return (
            <Link
              key={c.id}
              href="/admin/clases"
              className="flex flex-col gap-2 rounded-xl border border-white/5 bg-black/20 px-4 py-3 hover:border-orange-500/20 transition-colors sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold truncate">{c.nombre}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatTime(c.hora_inicio)}
                  {c.coach_nombre ? ` · ${c.coach_nombre}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {labels.cupo}: {occupied}/{c.cupo_maximo}
                </span>
                <Badge variant={badgeVariant}>
                  {labels.status[status]}
                </Badge>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
