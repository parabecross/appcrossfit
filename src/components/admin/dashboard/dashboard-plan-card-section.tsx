import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { toSubscriptionSummary } from "@/lib/queries/subscriptions";
import { CurrentPlanCard } from "@/components/plans/current-plan-card";

export async function DashboardPlanCardSection({
  boxId,
  labels,
}: {
  boxId: string;
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
  const entitlements = await getBoxEntitlements(boxId);
  const subscription = toSubscriptionSummary(entitlements);

  return (
    <CurrentPlanCard subscription={subscription} labels={labels} />
  );
}
