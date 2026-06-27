import { forwardRef, type ReactNode } from "react";
import type { LegacyCardFormat } from "@/lib/legacy/types";
import { LEGACY_CARD_DIMENSIONS } from "@/lib/legacy/types";
import { cn } from "@/lib/utils";

/** Tipografía fija para canvas 1080px — legible al exportar en móvil */
export const CARD_TYPO = {
  legacy: 38,
  byAthron: 28,
  name: 92,
  discipline: 32,
  tagline: 36,
  statLabel: 24,
  statValue: 44,
  goalLabel: 24,
  goalValue: 34,
  footerName: 30,
  pad: 56,
  gap: 20,
} as const;

export const CardExportShell = forwardRef<
  HTMLDivElement,
  {
    format: LegacyCardFormat;
    accentColor: string;
    children: ReactNode;
    className?: string;
    previewScale?: number;
  }
>(function CardExportShell(
  { format, accentColor, children, className, previewScale },
  ref
) {
  const { width, height } = LEGACY_CARD_DIMENSIONS[format];
  const scale = previewScale ?? 1;
  const scaledW = width * scale;
  const scaledH = height * scale;

  return (
    <div
      ref={ref}
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
              "linear-gradient(165deg, #222226 0%, #1a1a1e 50%, #242428 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-45 blur-3xl"
            style={{ backgroundColor: accentColor }}
          />
          <div
            className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full opacity-30 blur-3xl"
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
});

export function CardBrandingFooter({
  boxName,
  boxLogoUrl,
  accentColor,
}: {
  boxName: string;
  boxLogoUrl: string | null;
  accentColor: string;
}) {
  return (
    <div
      className="flex items-center gap-4 border-t border-white/20 pt-5"
      style={{ borderTopWidth: 2 }}
    >
      {boxLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={boxLogoUrl}
          alt=""
          className="rounded-xl object-cover"
          style={{ width: 56, height: 56 }}
          crossOrigin="anonymous"
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-xl font-black"
          style={{
            width: 56,
            height: 56,
            fontSize: 20,
            backgroundColor: `${accentColor}33`,
            color: accentColor,
          }}
        >
          {boxName.slice(0, 2).toUpperCase()}
        </div>
      )}
      <span
        className="truncate font-bold uppercase tracking-wider text-white/95"
        style={{ fontSize: CARD_TYPO.footerName }}
      >
        {boxName}
      </span>
    </div>
  );
}
