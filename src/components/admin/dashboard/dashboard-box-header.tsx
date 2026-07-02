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
    controlPanel: string;
    poweredBy: string;
    platformTagline: string;
  };
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {labels.poweredBy}
          </p>
          <span className="text-muted-foreground/40">·</span>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] brand-text">
            {APP_CONFIG.BRAND_NAME}
          </p>
        </div>
        <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground leading-tight">
          {boxName}
        </h1>
        <p className="text-xs text-muted-foreground capitalize">
          {labels.controlPanel} · {formatHeaderDate(today, locale)}
        </p>
      </div>

      <div className="hidden sm:inline-flex items-center gap-2.5 w-fit shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
        <AthronLogo className="h-8 w-auto max-w-[88px] mx-0 drop-shadow-none" />
        <p className="text-[10px] text-muted-foreground leading-tight max-w-[120px]">
          {labels.platformTagline}
        </p>
      </div>
    </header>
  );
}
