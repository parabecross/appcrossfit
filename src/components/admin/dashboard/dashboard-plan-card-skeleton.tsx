export function DashboardPlanCardSkeleton() {
  return (
    <div
      className="rounded-2xl border border-white/10 bg-card/50 p-5 animate-pulse space-y-3"
      aria-busy="true"
      aria-label="Cargando plan"
    >
      <div className="h-4 w-32 rounded bg-white/5" />
      <div className="h-8 w-48 rounded bg-white/5" />
      <div className="h-3 w-full max-w-md rounded bg-white/5" />
    </div>
  );
}
