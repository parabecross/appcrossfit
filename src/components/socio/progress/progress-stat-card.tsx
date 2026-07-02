"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProgressStatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "orange",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  accent?: "orange" | "red" | "neutral";
  className?: string;
}) {
  const iconBg =
    accent === "red"
      ? "bg-red-500/10 text-red-400"
      : accent === "neutral"
        ? "bg-white/5 text-muted-foreground"
        : "bg-orange-500/10 text-orange-400";

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2",
        className
      )}
    >
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          iconBg
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/90 truncate">
          {label}
        </p>
        <p className="text-[13px] font-bold leading-tight text-foreground line-clamp-2 mt-0.5">
          {value}
        </p>
        {hint ? (
          <p className="text-[10px] text-muted-foreground/70 line-clamp-1 mt-0.5 hidden sm:block">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
