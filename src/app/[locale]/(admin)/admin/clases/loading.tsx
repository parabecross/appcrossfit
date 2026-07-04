export default function AdminClasesLoading() {
  return (
    <div
      className="space-y-4 animate-pulse pb-10"
      aria-busy="true"
      aria-label="Cargando clases"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-8 w-40 rounded-lg bg-white/5" />
        <div className="flex gap-2">
          <div className="h-10 w-24 rounded-xl bg-white/5" />
          <div className="h-10 w-24 rounded-xl bg-white/5" />
        </div>
      </div>
      <div className="h-12 rounded-xl border border-white/5 bg-white/5" />
      <div className="h-[420px] rounded-2xl border border-white/5 bg-white/5" />
    </div>
  );
}
