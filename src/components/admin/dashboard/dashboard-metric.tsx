import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardMetric({
  icon: Icon,
  label,
  value,
  hint,
  accent = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  accent?: "orange" | "green" | "red" | "neutral";
}) {
  const accentClass =
    accent === "green"
      ? "border-green-500/20 from-green-500/10"
      : accent === "red"
        ? "border-red-500/20 from-red-500/10"
        : accent === "orange"
          ? "border-orange-500/20 from-orange-500/10"
          : "border-white/10 from-white/[0.03]";

  const iconClass =
    accent === "green"
      ? "text-green-400"
      : accent === "red"
        ? "text-red-400"
        : accent === "orange"
          ? "text-orange-400"
          : "text-muted-foreground";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-gradient-to-br to-transparent p-4",
        accentClass
      )}
    >
      <Icon className={cn("h-4 w-4 mb-2", iconClass)} />
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-2xl font-black mt-1 tabular-nums">{value}</p>
      {hint && (
        <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>
      )}
    </div>
  );
}
