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
    daysRemaining: string;
    daysRemainingUrgent: string;
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
        "rounded-2xl border p-4 md:p-5",
        isPromo
          ? "border-orange-500/25 bg-gradient-to-r from-orange-500/[0.1] via-orange-500/[0.04] to-transparent"
          : "border-white/10 bg-white/[0.02]"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              isPromo ? "bg-orange-500/15 text-orange-400" : "bg-white/5 text-orange-400/80"
            )}
          >
            {code === "elite" ? (
              <Crown className="h-5 w-5" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-400/90">
              {labels.currentPlan}
            </p>
            <p className="text-lg font-black leading-tight truncate">
              {subscription.displayPlanName}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] border-white/10",
                  isPromo && "border-orange-500/30 text-orange-200/90"
                )}
              >
                {subscription.statusLabel}
              </Badge>
              {!isPromo && subscription.status === "active" && (
                <span className="text-xs text-muted-foreground">
                  ${subscription.priceMxn.toLocaleString("es-MX")} {labels.perMonth}
                </span>
              )}
            </div>
          </div>
        </div>

        {isPromo && days !== null && (
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-3 shrink-0",
              urgent
                ? "border-orange-500/40 bg-orange-500/10"
                : "border-white/10 bg-white/[0.03]"
            )}
          >
            <div className="text-right">
              <p
                className={cn(
                  "text-3xl font-black tabular-nums leading-none",
                  urgent ? "text-orange-300" : "text-foreground"
                )}
              >
                {days}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                {labels.daysLabel}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-white/5 text-sm text-muted-foreground">
        {isPromo && (
          <p className={cn(urgent && "text-orange-200/90 font-medium")}>
            {urgent
              ? labels.daysRemainingUrgent.replace("{days}", String(days))
              : labels.fullAccess}
          </p>
        )}

        {!isPromo && subscription.status === "active" && (
          <p>{limits}</p>
        )}

        {subscription.status === "expired" && (
          <div className="flex items-start gap-2 text-orange-200/90">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>{labels.promotionalEnded}</p>
          </div>
        )}

        {!isPromo && subscription.status === "active" && (
          <p className="text-xs mt-2 text-muted-foreground/80">
            {subscription.athleteUsed}
            {subscription.athleteLimit != null ? ` / ${subscription.athleteLimit}` : ""}{" "}
            {labels.activeAthletes}
          </p>
        )}
      </div>
    </section>
  );
}
