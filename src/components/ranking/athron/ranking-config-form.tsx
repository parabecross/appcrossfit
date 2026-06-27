"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RankingConfig } from "@/types/database";

export function RankingConfigForm({
  initial,
}: {
  initial: RankingConfig;
}) {
  const t = useTranslations("rankingAthron");
  const tc = useTranslations("common");
  const [config, setConfig] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setLoading(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/admin/ranking-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      setError(body.error ?? tc("error"));
      return;
    }
    setSaved(true);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between rounded-xl border border-white/10 p-4">
        <div>
          <p className="font-semibold">{t("configEnabled")}</p>
          <p className="text-xs text-muted-foreground">{t("configEnabledHint")}</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) =>
              setConfig({ ...config, enabled: e.target.checked })
            }
            className="h-4 w-4 rounded"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>{t("configAttendance")}</Label>
          <Input
            type="number"
            value={config.attendance_points}
            onChange={(e) =>
              setConfig({
                ...config,
                attendance_points: parseInt(e.target.value, 10) || 0,
              })
            }
          />
        </div>
        <div>
          <Label>{t("configMinAttendances")}</Label>
          <Input
            type="number"
            value={config.min_attendances_to_rank}
            onChange={(e) =>
              setConfig({
                ...config,
                min_attendances_to_rank: parseInt(e.target.value, 10) || 0,
              })
            }
          />
        </div>
      </div>

      <div>
        <Label>{t("configTagline")}</Label>
        <Input
          value={config.tagline}
          onChange={(e) => setConfig({ ...config, tagline: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>{t("configPositionFloor")}</Label>
          <Input
            type="number"
            value={config.position_points_floor}
            onChange={(e) =>
              setConfig({
                ...config,
                position_points_floor: parseInt(e.target.value, 10) || 0,
              })
            }
          />
        </div>
        <div>
          <Label>{t("configRxBonus")}</Label>
          <Input
            type="number"
            value={config.rx_bonus_points}
            onChange={(e) =>
              setConfig({
                ...config,
                rx_bonus_points: parseInt(e.target.value, 10) || 0,
              })
            }
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {(["small", "medium", "large"] as const).map((tier) => (
          <div key={tier}>
            <Label>{t(`configEvolution_${tier}`)}</Label>
            <Input
              type="number"
              value={config.evolution_bonuses[tier]}
              onChange={(e) =>
                setConfig({
                  ...config,
                  evolution_bonuses: {
                    ...config.evolution_bonuses,
                    [tier]: parseInt(e.target.value, 10) || 0,
                  },
                })
              }
            />
          </div>
        ))}
      </div>

      <Button onClick={() => void save()} disabled={loading} className="w-full">
        {loading ? tc("loading") : t("configSave")}
      </Button>

      {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      {saved && (
        <p className="text-sm text-green-400 text-center">{t("configSaved")}</p>
      )}
    </div>
  );
}
