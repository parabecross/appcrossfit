import type { ReactNode } from "react";
import type { LegacyCardFormat } from "@/lib/legacy/types";
import { LEGACY_CARD_DIMENSIONS } from "@/lib/legacy/types";
import { cn } from "@/lib/utils";

export function CardExportShell({
  format,
  accentColor,
  children,
  className,
  previewScale,
}: {
  format: LegacyCardFormat;
  accentColor: string;
  children: ReactNode;
  className?: string;
  previewScale?: number;
}) {
  const { width, height } = LEGACY_CARD_DIMENSIONS[format];
  const scale = previewScale ?? 1;
  const scaledW = width * scale;
  const scaledH = height * scale;

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{
        width: scaledW,
        height: scaledH,
      }}
    >
      <div
        className="origin-top-left"
        style={{
          width,
          height,
          transform: scale !== 1 ? `scale(${scale})` : undefined,
        }}
      >
        <div
          className="relative h-full w-full overflow-hidden text-white"
          style={{
            width,
            height,
            background:
              "linear-gradient(165deg, #2a2a2e 0%, #222226 50%, #28282c 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-50 blur-3xl"
            style={{ backgroundColor: accentColor }}
          />
          <div
            className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full opacity-35 blur-3xl"
            style={{ backgroundColor: accentColor }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
            style={{
              background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
            }}
          />
          {children}
        </div>
      </div>
    </div>
  );
}

export function CardBrandingFooter({
  boxName,
  boxLogoUrl,
  poweredByLabel,
  accentColor,
}: {
  boxName: string;
  boxLogoUrl: string | null;
  poweredByLabel: string;
  accentColor: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/15 pt-4">
      <div className="flex min-w-0 items-center gap-2">
        {boxLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={boxLogoUrl}
            alt=""
            className="h-8 w-8 rounded-lg object-cover"
            crossOrigin="anonymous"
          />
        ) : (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-black"
            style={{ backgroundColor: `${accentColor}33`, color: accentColor }}
          >
            {boxName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <span className="truncate text-sm font-bold uppercase tracking-wider text-white/90">
          {boxName}
        </span>
      </div>
      <p className="shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
        {poweredByLabel}
      </p>
    </div>
  );
}
