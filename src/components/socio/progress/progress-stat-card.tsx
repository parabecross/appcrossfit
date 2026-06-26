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
  const accentClass =
    accent === "red"
      ? "from-red-500/20 to-transparent border-red-500/20"
      : accent === "neutral"
        ? "from-white/5 to-transparent border-white/10"
        : "from-orange-500/20 to-transparent border-orange-500/20";

  const iconClass =
    accent === "red"
      ? "text-red-400"
      : accent === "neutral"
        ? "text-muted-foreground"
        : "text-orange-400";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 transition-all duration-300",
        "hover:border-orange-500/30 hover:shadow-[0_0_24px_-8px_rgba(249,115,22,0.35)]",
        accentClass,
        className
      )}
    >
      <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-orange-500/5 blur-2xl transition-opacity group-hover:opacity-100 opacity-60" />
      <Icon className={cn("h-4 w-4 mb-3", iconClass)} />
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-bold leading-snug text-foreground line-clamp-2">
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-[11px] text-muted-foreground/80 line-clamp-1">
          {hint}
        </p>
      )}
    </div>
  );
}
