import { formatPrValue } from "@/lib/progreso/helpers";
import { cn } from "@/lib/utils";
import type { PrUnidad } from "@/types/database";

export function DashboardAthleteProgress({
  recentPrs,
  recentSkills,
  topConsistent,
  labels,
  embedded = false,
  compact = false,
}: {
  recentPrs: Array<{
    valor: number;
    unidad: string;
    nombre: string;
    exerciseDisplay: string;
  }>;
  recentSkills: Array<{
    nombre: string;
    skillDisplay: string;
  }>;
  topConsistent: Array<{ name: string; frequency: number }>;
  labels: {
    title: string;
    recentPrs: string;
    recentSkills: string;
    topConsistent: string;
    empty: string;
    perWeek: string;
  };
  embedded?: boolean;
  compact?: boolean;
}) {
  const hasData =
    recentPrs.length > 0 ||
    recentSkills.length > 0 ||
    topConsistent.length > 0;

  const prLimit = compact ? 3 : 4;
  const skillLimit = compact ? 2 : 4;
  const consistentLimit = compact ? 3 : 10;

  return (
    <div
      className={
        embedded
          ? "space-y-3"
          : "rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4"
      }
    >
      {!embedded && <p className="text-sm font-bold">{labels.title}</p>}

      {!hasData ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div
          className={cn(
            "grid gap-4",
            compact ? "grid-cols-1" : "md:grid-cols-3"
          )}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              {labels.recentPrs}
            </p>
            <div className="space-y-2">
              {recentPrs.slice(0, prLimit).map((p) => (
                <div
                  key={`${p.nombre}-${p.exerciseDisplay}-${p.valor}`}
                  className="text-sm rounded-lg border border-white/5 px-3 py-2"
                >
                  <p className="font-medium truncate">{p.nombre}</p>
                  <p className="text-xs text-orange-300 mt-0.5">
                    {p.exerciseDisplay} ·{" "}
                    {formatPrValue(p.valor, p.unidad as PrUnidad)}
                  </p>
                </div>
              ))}
              {recentPrs.length === 0 && (
                <p className="text-xs text-muted-foreground">—</p>
              )}
            </div>
          </div>

          {!compact && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              {labels.recentSkills}
            </p>
            <div className="space-y-2">
              {recentSkills.slice(0, skillLimit).map((s) => (
                <div
                  key={`${s.nombre}-${s.skillDisplay}`}
                  className="text-sm rounded-lg border border-white/5 px-3 py-2"
                >
                  <p className="font-medium truncate">{s.nombre}</p>
                  <p className="text-xs text-orange-300 mt-0.5">
                    {s.skillDisplay}
                  </p>
                </div>
              ))}
              {recentSkills.length === 0 && (
                <p className="text-xs text-muted-foreground">—</p>
              )}
            </div>
          </div>
          )}

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              {labels.topConsistent}
            </p>
            <div className="space-y-2">
              {topConsistent.slice(0, consistentLimit).map((a) => (
                <div
                  key={a.name}
                  className="flex justify-between text-sm rounded-lg border border-white/5 px-3 py-2"
                >
                  <span className="font-medium truncate">{a.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0 ml-2">
                    {a.frequency} {labels.perWeek}
                  </span>
                </div>
              ))}
              {topConsistent.length === 0 && (
                <p className="text-xs text-muted-foreground">—</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
