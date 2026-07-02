import { AlertTriangle, Crown, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PlanCode } from "@/lib/entitlements/features";
import type { BoxSubscriptionSummary } from "@/lib/queries/subscriptions";
import { cn } from "@/lib/utils";

function limitsKey(code: PlanCode): "limitsStart" | "limitsPro" | "limitsElite" {
  if (code === "start") return "limitsStart";
  if (code === "pro") return "limitsPro";
  return "limitsElite";
}

export function CurrentPlanCard({
  subscription,
  labels,
}: {
  subscription: BoxSubscriptionSummary;
  labels: {
    currentPlan: string;
    promotionalActive: string;
    formatDaysRemainingUrgent: (days: number) => string;
    promotionalEnded: string;
    fullAccess: string;
    perMonth: string;
    activeAthletes: string;
    limitsStart: string;
    limitsPro: string;
    limitsElite: string;
    daysLabel: string;
  };
}) {
  const code = subscription.planCode;
  const isPromo = subscription.isPromotional;
  const days = subscription.promotionalDaysRemaining;
  const urgent = isPromo && days !== null && days <= 7;
  const limits = labels[limitsKey(code)];

  return (
    <section
      className={cn(
        "rounded-xl border px-4 py-3",
        isPromo
          ? "border-orange-500/20 bg-gradient-to-r from-orange-500/[0.08] to-transparent"
          : "border-white/10 bg-white/[0.02]"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              isPromo ? "bg-orange-500/15 text-orange-400" : "bg-white/5 text-orange-400/80"
            )}
          >
            {code === "elite" ? (
              <Crown className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black leading-tight truncate">
              {subscription.displayPlanName}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <Badge
                variant="outline"
                className={cn(
                  "text-[9px] h-5 border-white/10",
                  isPromo && "border-orange-500/30 text-orange-200/90"
                )}
              >
                {isPromo ? labels.promotionalActive : subscription.statusLabel}
              </Badge>
              {!isPromo && subscription.status === "active" && (
                <span className="text-[10px] text-muted-foreground">
                  ${subscription.priceMxn.toLocaleString("es-MX")} {labels.perMonth}
                </span>
              )}
            </div>
          </div>
        </div>

        {isPromo && days !== null && (
          <div className="text-right shrink-0">
            <p
              className={cn(
                "text-2xl font-black tabular-nums leading-none",
                urgent ? "text-orange-300" : "text-foreground"
              )}
            >
              {days}
            </p>
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground mt-0.5">
              {labels.daysLabel}
            </p>
          </div>
        )}

        {subscription.status === "expired" && (
          <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />
        )}
      </div>

      {isPromo && urgent && (
        <p className="text-xs text-orange-200/90 mt-2 pt-2 border-t border-white/5">
          {labels.formatDaysRemainingUrgent(days ?? 0)}
        </p>
      )}

      {!isPromo && subscription.status === "active" && (
        <p className="text-[10px] text-muted-foreground/80 mt-2 pt-2 border-t border-white/5">
          {subscription.athleteUsed}
          {subscription.athleteLimit != null ? ` / ${subscription.athleteLimit}` : ""}{" "}
          {labels.activeAthletes} · {limits}
        </p>
      )}

      {subscription.status === "expired" && (
        <p className="text-xs text-orange-200/90 mt-2 pt-2 border-t border-white/5">
          {labels.promotionalEnded}
        </p>
      )}
    </section>
  );
}
