export default function AdminLoading() {
  return (
    <div
      className="space-y-6 animate-pulse pb-10 max-w-6xl"
      aria-busy="true"
      aria-label="Cargando"
    >
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-56 rounded-lg bg-white/5" />
        <div className="h-4 w-full max-w-md rounded bg-white/5" />
      </div>

      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-2xl border border-white/5 bg-white/5"
          />
        ))}
      </div>

      {/* Main dashboard / calendar block */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-2xl border border-white/5 bg-white/5" />
        <div className="h-64 rounded-2xl border border-white/5 bg-white/5" />
      </div>

      {/* Activity list / table */}
      <div className="rounded-2xl border border-white/5 bg-white/5 p-4 space-y-3">
        <div className="h-5 w-40 rounded bg-white/5" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-white/5" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/5 max-w-xs rounded bg-white/5" />
              <div className="h-3 w-2/5 max-w-[10rem] rounded bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
