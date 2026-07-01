import { Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { minPlanLabelForFeature, type FeatureKey } from "@/lib/entitlements/features";

export function LockedFeatureCard({
  featureKey,
  title,
  description,
  requiredPlanLabel,
}: {
  featureKey?: FeatureKey;
  title: string;
  description?: string;
  requiredPlanLabel?: string | null;
}) {
  const planLabel =
    requiredPlanLabel ?? (featureKey ? minPlanLabelForFeature(featureKey) : null);

  return (
    <Card className="border-dashed border-orange-500/30 bg-orange-500/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-orange-400" />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {planLabel
            ? `Disponible en ${planLabel}.`
            : "Actualiza tu plan para desbloquear esta función."}
        </p>
      </CardContent>
    </Card>
  );
}
