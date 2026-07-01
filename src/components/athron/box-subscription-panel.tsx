"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlanBadge } from "@/components/plans/plan-badge";
import { FEATURE_LABELS } from "@/lib/entitlements/features";
import type { FeatureKey, PlanCode } from "@/lib/entitlements/features";
import {
  FEATURE_UI_GROUPS,
  isFeatureToggleDisabled,
} from "@/lib/entitlements/feature-deps";
import type { BoxStatus } from "@/types/database";
import { cn } from "@/lib/utils";

type SubscriptionData = {
  displayPlanName: string;
  planCode: PlanCode;
  status: string;
  statusLabelSuperAdmin: string;
  priceMxn: number;
  startedAt: string;
  currentPeriodEnd: string | null;
  promotionalDaysRemaining: number | null;
  athleteUsed: number;
  athleteLimit: number | null;
  coachUsed: number;
  coachLimit: number | null;
  adminUsed: number;
  adminLimit: number | null;
  notes: string | null;
  features: Array<{
    key: FeatureKey;
    label: string;
    enabled: boolean;
    rawEnabled?: boolean;
    blockedBy?: FeatureKey | null;
    source: string;
    sourceLabel: string;
  }>;
};

function featureMapFromData(features: SubscriptionData["features"]) {
  return Object.fromEntries(features.map((f) => [f.key, f.enabled])) as Record<
    FeatureKey,
    boolean
  >;
}

function FeatureToggleRow({
  featureKey,
  feat,
  featureState,
  loading,
  disabled,
  indent,
  onToggle,
}: {
  featureKey: FeatureKey;
  feat?: SubscriptionData["features"][number];
  featureState: Record<FeatureKey, boolean>;
  loading: boolean;
  disabled?: boolean;
  indent?: boolean;
  onToggle: (key: FeatureKey, enabled: boolean) => void;
}) {
  const enabled = feat?.enabled ?? false;
  const sourceLabel = feat?.sourceLabel ?? FEATURE_LABELS[featureKey];
  const toggleDisabled =
    disabled || loading || isFeatureToggleDisabled(featureKey, featureState);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border border-white/5 px-3 py-2",
        indent && "ml-4 border-l-2 border-l-white/10",
        toggleDisabled && !enabled && "opacity-60"
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{FEATURE_LABELS[featureKey]}</p>
        <p className="text-xs text-muted-foreground truncate">{sourceLabel}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant={enabled ? "default" : "outline"}
        disabled={toggleDisabled}
        title={
          toggleDisabled && isFeatureToggleDisabled(featureKey, featureState)
            ? sourceLabel
            : undefined
        }
        onClick={() => onToggle(featureKey, !enabled)}
      >
        {enabled ? "ON" : "OFF"}
      </Button>
    </div>
  );
}

function boxStatusVariant(status: BoxStatus) {
  if (status === "active") return "success" as const;
  if (status === "trial") return "warning" as const;
  return "destructive" as const;
}

export function BoxSubscriptionPanel({
  boxId,
  boxStatus,
  initial,
  labels,
}: {
  boxId: string;
  boxStatus: BoxStatus;
  initial: SubscriptionData;
  labels: Record<string, string> & {
    boxOperationalStatusLabel: string;
  };
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(initial.notes ?? "");

  useEffect(() => {
    setData(initial);
    setNotes(initial.notes ?? "");
  }, [initial]);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const call = async (path: string, method: string, body?: unknown) => {
    setLoading(path);
    setError(null);
    const res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Error");
      setLoading(null);
      return;
    }
    setData(json);
    setNotes(json.notes ?? "");
    setLoading(null);
    router.refresh();
  };

  const changePlan = (planCode: PlanCode) =>
    call(`/api/admin-athron/boxes/${boxId}/subscription`, "PATCH", {
      planCode,
      status: "active",
    });

  const limitText = (used: number, max: number | null) =>
    max == null ? `${used} / ∞` : `${used} / ${max}`;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <Card className="border-white/10 bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{labels.statusOverview}</CardTitle>
          <CardDescription>{labels.statusOverviewDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-white/5 bg-black/20 p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {labels.boxOperationalStatus}
              </p>
              <Badge variant={boxStatusVariant(boxStatus)}>
                {labels.boxOperationalStatusLabel}
              </Badge>
              <p className="text-xs text-muted-foreground">{labels.boxOperationalHint}</p>
            </div>
            <div className="rounded-lg border border-orange-500/20 bg-orange-500/[0.04] p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400/80">
                {labels.subscriptionStatusDetail}
              </p>
              <Badge variant="outline" className="border-orange-500/30 text-orange-200/90">
                {data.statusLabelSuperAdmin}
              </Badge>
              {data.promotionalDaysRemaining != null && (
                <p className="text-xs text-orange-300/90">
                  {labels.promoDays}: {data.promotionalDaysRemaining} días
                </p>
              )}
            </div>
            <div className="rounded-lg border border-white/5 bg-black/20 p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {labels.saasPlan}
              </p>
              <div className="flex items-center gap-2">
                <PlanBadge code={data.planCode} />
                <span className="text-sm text-muted-foreground">
                  ${data.priceMxn.toLocaleString("es-MX")}/mes
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="box-plan" className="scroll-mt-6 border-orange-500/15">
        <CardHeader>
          <CardTitle>{labels.planSection}</CardTitle>
          <CardDescription>{labels.planSectionDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div>
              <p className="text-muted-foreground">{labels.startedAt}</p>
              <p className="font-medium">
                {new Date(data.startedAt).toLocaleDateString("es-MX")}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{labels.periodEnd}</p>
              <p className="font-medium">
                {data.currentPeriodEnd
                  ? new Date(data.currentPeriodEnd).toLocaleDateString("es-MX")
                  : "—"}
              </p>
            </div>
            {data.promotionalDaysRemaining != null && (
              <div>
                <p className="text-muted-foreground">{labels.promoDays}</p>
                <p className="font-medium text-orange-300">
                  {data.promotionalDaysRemaining} días
                </p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">{labels.athletes}</p>
              <p className="font-medium">{limitText(data.athleteUsed, data.athleteLimit)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{labels.coaches}</p>
              <p className="font-medium">{limitText(data.coachUsed, data.coachLimit)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{labels.admins}</p>
              <p className="font-medium">{limitText(data.adminUsed, data.adminLimit)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!!loading}
              onClick={() => changePlan("start")}
            >
              {labels.changeStart}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!!loading}
              onClick={() => changePlan("pro")}
            >
              {labels.changePro}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!!loading}
              onClick={() => changePlan("elite")}
            >
              {labels.changeElite}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!!loading}
              onClick={() =>
                call(`/api/admin-athron/boxes/${boxId}/promotional-access`, "POST", {
                  days: 30,
                })
              }
            >
              {labels.activatePromo}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!!loading}
              onClick={() =>
                call(`/api/admin-athron/boxes/${boxId}/promotional-access`, "POST", {
                  days: 30,
                  extend: true,
                })
              }
            >
              {labels.extendPromo}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={!!loading}
              onClick={() => call(`/api/admin-athron/boxes/${boxId}/suspend`, "POST")}
            >
              {labels.suspend}
            </Button>
            <Button
              size="sm"
              variant="default"
              disabled={!!loading}
              onClick={() => call(`/api/admin-athron/boxes/${boxId}/reactivate`, "POST")}
            >
              {labels.reactivate}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!!loading}
              onClick={() =>
                call(`/api/admin-athron/boxes/${boxId}/subscription`, "PATCH", {
                  status: "canceled",
                })
              }
            >
              {labels.cancel}
            </Button>
          </div>

          <div className="space-y-2 pt-2 border-t border-white/5">
            <Label htmlFor="sub-notes">{labels.notes}</Label>
            <Textarea
              id="sub-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!!loading}
              onClick={() =>
                call(`/api/admin-athron/boxes/${boxId}/subscription`, "PATCH", { notes })
              }
            >
              {labels.saveNotes}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card id="box-features" className="scroll-mt-6 border-white/10">
        <CardHeader>
          <CardTitle>{labels.featuresSection}</CardTitle>
          <CardDescription>{labels.featuresSectionDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(() => {
            const byKey = new Map(data.features.map((f) => [f.key, f]));
            const featureState = featureMapFromData(data.features);

            const toggle = (key: FeatureKey, enabled: boolean) =>
              void call(`/api/admin-athron/boxes/${boxId}/feature-overrides`, "PATCH", {
                featureKey: key,
                enabled,
                reason: "Ajuste manual Super Admin",
              });

            return FEATURE_UI_GROUPS.map((group) => {
              if (group.type === "standalone") {
                return (
                  <div key="standalone" className="space-y-2">
                    {group.keys.map((key) => (
                      <FeatureToggleRow
                        key={key}
                        featureKey={key}
                        feat={byKey.get(key)}
                        featureState={featureState}
                        loading={!!loading}
                        onToggle={toggle}
                      />
                    ))}
                  </div>
                );
              }

              const parentFeat = byKey.get(group.parent);
              const parentOn = featureState[group.parent] ?? false;

              return (
                <div key={group.parent} className="space-y-2">
                  <FeatureToggleRow
                    featureKey={group.parent}
                    feat={parentFeat}
                    featureState={featureState}
                    loading={!!loading}
                    onToggle={toggle}
                  />
                  <div className="space-y-2">
                    {group.children.map((key) => (
                      <FeatureToggleRow
                        key={key}
                        featureKey={key}
                        feat={byKey.get(key)}
                        featureState={featureState}
                        loading={!!loading}
                        indent
                        disabled={!parentOn}
                        onToggle={toggle}
                      />
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </CardContent>
      </Card>
    </div>
  );
}