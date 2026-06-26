import { APP_CONFIG } from "@/lib/config/app-config";
import { AthronLogo } from "@/components/brand/athron-logo";

function formatHeaderDate(date: string, locale: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

export function DashboardBoxHeader({
  boxName,
  today,
  locale,
  labels,
}: {
  boxName: string;
  today: string;
  locale: string;
  labels: {
    pageTitle: string;
    poweredBy: string;
    platformTagline: string;
  };
}) {
  return (
    <header className="rounded-2xl border border-orange-500/15 bg-gradient-to-br from-orange-500/[0.07] via-transparent to-red-500/[0.03] p-5 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {labels.poweredBy}
            </p>
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/25 px-2 py-1 sm:hidden">
              <AthronLogo className="h-6 w-auto max-w-[72px] mx-0 drop-shadow-none" />
            </div>
            <p className="hidden sm:inline text-[10px] font-bold uppercase tracking-[0.16em] brand-text">
              {APP_CONFIG.BRAND_NAME}
            </p>
          </div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-foreground uppercase leading-tight">
            {boxName}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">
            {labels.pageTitle} · {formatHeaderDate(today, locale)}
          </p>
        </div>

        <div className="hidden sm:inline-flex items-center gap-3 w-fit shrink-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
          <AthronLogo className="h-12 w-auto max-w-[120px] mx-0 drop-shadow-none" />
          <div className="min-w-0">
            <p className="text-xs font-black tracking-wider brand-text">
              {APP_CONFIG.BRAND_NAME}
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {labels.platformTagline}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
