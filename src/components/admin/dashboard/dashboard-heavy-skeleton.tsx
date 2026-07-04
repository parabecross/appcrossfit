export function DashboardHeavySkeleton() {
  return (
    <div
      className="space-y-6 animate-pulse"
      aria-busy="true"
      aria-label="Cargando sección"
    >
      <div className="rounded-2xl border border-white/5 bg-white/5 p-5 space-y-3">
        <div className="h-4 w-48 rounded bg-white/5" />
        <div className="h-16 rounded-xl bg-white/5" />
      </div>

      <div className="h-72 rounded-2xl border border-white/5 bg-white/5" />

      <div className="rounded-2xl border border-white/5 bg-white/5 p-5 space-y-4">
        <div className="h-5 w-40 rounded bg-white/5" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-48 rounded-xl bg-white/5" />
          <div className="h-48 rounded-xl bg-white/5" />
        </div>
      </div>
    </div>
  );
}
