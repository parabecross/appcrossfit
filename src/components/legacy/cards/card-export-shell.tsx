import { forwardRef, type ReactNode } from "react";
import type { LegacyCardFormat } from "@/lib/legacy/types";
import { LEGACY_CARD_DIMENSIONS } from "@/lib/legacy/types";
import { isLocalAvatarUrl } from "@/lib/avatars/placeholder";
import { cn } from "@/lib/utils";
import { CARD_TYPO } from "@/components/legacy/cards/card-typography";

export { CARD_TYPO };

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
  { format, children, className, previewScale },
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
      style={{ width: scaledW, height: scaledH }}
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
          style={{ width, height, background: "#121214" }}
        >
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
      className="flex items-center gap-3"
      style={{ paddingTop: CARD_TYPO.gap }}
    >
      {boxLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={boxLogoUrl}
          alt=""
          loading="eager"
          decoding="async"
          className="rounded-full object-cover"
          style={{ width: 40, height: 40 }}
          {...(!isLocalAvatarUrl(boxLogoUrl)
            ? { crossOrigin: "anonymous" as const }
            : {})}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-full font-semibold"
          style={{
            width: 40,
            height: 40,
            fontSize: 14,
            backgroundColor: `${accentColor}22`,
            color: accentColor,
            border: `1px solid ${accentColor}44`,
          }}
        >
          {boxName.slice(0, 2).toUpperCase()}
        </div>
      )}
      <span
        className="truncate font-medium uppercase tracking-[0.14em] text-white/70"
        style={{ fontSize: CARD_TYPO.footerName }}
      >
        {boxName}
      </span>
    </div>
  );
}
