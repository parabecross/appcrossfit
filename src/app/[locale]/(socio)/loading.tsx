export default function SocioLoading() {
  return (
    <div className="space-y-4 animate-pulse pb-24 md:pb-0" aria-busy="true" aria-label="Cargando">
      <div className="h-8 w-48 rounded-lg bg-white/5" />
      <div className="h-4 w-full max-w-sm rounded bg-white/5" />
      <div className="h-32 rounded-2xl bg-white/5" />
      <div className="h-48 rounded-2xl bg-white/5" />
    </div>
  );
}
