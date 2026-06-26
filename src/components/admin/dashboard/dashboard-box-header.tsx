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
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {labels.poweredBy}{" "}
            <span className="brand-text">{APP_CONFIG.BRAND_NAME}</span>
          </p>
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-foreground uppercase">
            {boxName}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">
            {labels.pageTitle} · {formatHeaderDate(today, locale)}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
          <AthronLogo className="max-w-[56px] mx-0 drop-shadow-none" />
          <div className="hidden sm:block min-w-0">
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
