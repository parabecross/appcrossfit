import { formatPrValue } from "@/lib/progreso/helpers";
import type { PrUnidad } from "@/types/database";

export function DashboardAthleteProgress({
  recentPrs,
  recentSkills,
  topConsistent,
  labels,
  exerciseLabel,
  skillLabel,
}: {
  recentPrs: Array<{
    ejercicio: string;
    valor: number;
    unidad: string;
    nombre: string;
  }>;
  recentSkills: Array<{
    skill: string;
    estado: string;
    nombre: string;
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
  exerciseLabel: (key: string) => string;
  skillLabel: (key: string) => string;
}) {
  const hasData =
    recentPrs.length > 0 ||
    recentSkills.length > 0 ||
    topConsistent.length > 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
      <p className="text-sm font-bold">{labels.title}</p>

      {!hasData ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              {labels.recentPrs}
            </p>
            <div className="space-y-2">
              {recentPrs.slice(0, 4).map((p) => (
                <div
                  key={`${p.nombre}-${p.ejercicio}-${p.valor}`}
                  className="text-sm rounded-lg border border-white/5 px-3 py-2"
                >
                  <p className="font-medium truncate">{p.nombre}</p>
                  <p className="text-xs text-orange-300 mt-0.5">
                    {exerciseLabel(p.ejercicio)} ·{" "}
                    {formatPrValue(p.valor, p.unidad as PrUnidad)}
                  </p>
                </div>
              ))}
              {recentPrs.length === 0 && (
                <p className="text-xs text-muted-foreground">—</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              {labels.recentSkills}
            </p>
            <div className="space-y-2">
              {recentSkills.slice(0, 4).map((s) => (
                <div
                  key={`${s.nombre}-${s.skill}`}
                  className="text-sm rounded-lg border border-white/5 px-3 py-2"
                >
                  <p className="font-medium truncate">{s.nombre}</p>
                  <p className="text-xs text-orange-300 mt-0.5">
                    {skillLabel(s.skill)}
                  </p>
                </div>
              ))}
              {recentSkills.length === 0 && (
                <p className="text-xs text-muted-foreground">—</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              {labels.topConsistent}
            </p>
            <div className="space-y-2">
              {topConsistent.map((a) => (
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
