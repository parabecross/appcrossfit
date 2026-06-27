import type { ReactNode } from "react";

/**
 * Base layout for future shareable cards (PR, Ranking, Achievement, Athlete of Month).
 */
export function LegacyCardPlaceholder({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
      <p className="text-sm font-bold text-muted-foreground">{title}</p>
      {subtitle ? (
        <p className="text-xs text-muted-foreground/70 mt-1">{subtitle}</p>
      ) : null}
      {children}
    </div>
  );
}
