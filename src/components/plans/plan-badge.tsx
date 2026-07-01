import { Badge } from "@/components/ui/badge";
import { PLAN_LABELS, type PlanCode } from "@/lib/entitlements/features";
import { cn } from "@/lib/utils";

const VARIANT: Record<PlanCode, "default" | "secondary" | "outline"> = {
  start: "outline",
  pro: "secondary",
  elite: "default",
};

export function PlanBadge({
  code,
  className,
}: {
  code: PlanCode;
  className?: string;
}) {
  return (
    <Badge
      variant={VARIANT[code]}
      className={cn(
        "text-[10px] uppercase tracking-wide",
        code === "elite" && "bg-orange-500/20 text-orange-300 border-orange-500/30",
        className
      )}
    >
      {PLAN_LABELS[code]}
    </Badge>
  );
}
