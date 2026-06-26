import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth/get-profile";
import { getBoxConfig } from "@/lib/box/config";
import { getAlertasMembresia, getKpis } from "@/lib/queries/memberships";
import {
  getStatsData,
  computeFrequencyStats,
  computeDemandStats,
  computeTrendStats,
} from "@/lib/queries/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FrequencyChart,
  DemandChart,
  TrendChart,
} from "@/components/stats/charts";
import { Users, AlertTriangle, Clock, UserCheck } from "lucide-react";
import {
  ExpiredMembersList,
  ExpiringMembersList,
} from "@/components/admin/dashboard-alerts";

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireAdmin(locale);
  const boxConfig = await getBoxConfig(profile.box_id);
  const t = await getTranslations("admin");
  const ts = await getTranslations("stats");

  const [kpis, alertas, statsRaw] = await Promise.all([
    getKpis(),
    getAlertasMembresia(),
    getStatsData(),
  ]);

  const frequency = computeFrequencyStats(statsRaw.reservas);
  const demand = computeDemandStats(statsRaw.reservas, locale);
  const trend = computeTrendStats(statsRaw.reservas);

  const vencidas = alertas.filter((a) => a.tipo_alerta === "vencida");
  const porVencer = alertas.filter((a) => a.tipo_alerta === "por_vencer");

  const kpiCards = [
    {
      label: t("activeMembers"),
      value: kpis.activos,
      icon: UserCheck,
      color: "text-green-400",
    },
    {
      label: t("expiredMembers"),
      value: kpis.vencidos,
      icon: AlertTriangle,
      color: "text-red-400",
    },
    {
      label: t("pendingMembers"),
      value: kpis.pendientes,
      icon: Clock,
      color: "text-orange-400",
    },
    {
      label: "Total",
      value: kpis.total,
      icon: Users,
      color: "text-primary",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight brand-text">
          {t("dashboard")}
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-3xl font-black mt-1">{value}</p>
                </div>
                <Icon className={`h-8 w-8 ${color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              {t("expired")} ({vencidas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            <ExpiredMembersList items={vencidas} locale={locale} boxName={boxConfig.name} />
          </CardContent>
        </Card>

        <Card className="border-orange-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-400">
              <Clock className="h-5 w-5" />
              {t("expiringSoon")} ({porVencer.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            <ExpiringMembersList items={porVencer} locale={locale} boxName={boxConfig.name} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{ts("trend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={trend} locale={locale} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{ts("demand")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DemandChart data={demand} />
          </CardContent>
        </Card>
      </div>

      {frequency.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{ts("frequency")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FrequencyChart data={frequency.slice(0, 8)} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
