import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { requireSuperAdmin } from "@/lib/auth/get-profile";
import { getBoxWithStats } from "@/lib/queries/athron-admin";
import { getKpis, getAlertasMembresia } from "@/lib/queries/memberships";
import {
  getStatsData,
  computeFrequencyStats,
  computeDemandStats,
  computeTrendStats,
  computeOccupancyStats,
} from "@/lib/queries/stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FrequencyChart,
  DemandChart,
  TrendChart,
  OccupancyChart,
} from "@/components/stats/charts";
import { ArrowLeft, UserCheck, AlertTriangle, Clock, Users } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function AthronBoxDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireSuperAdmin(locale);
  const t = await getTranslations("athronAdmin");
  const ts = await getTranslations("stats");
  const ta = await getTranslations("admin");

  const box = await getBoxWithStats(id);
  if (!box) notFound();

  const [kpis, alertas, statsRaw] = await Promise.all([
    getKpis(id),
    getAlertasMembresia(id),
    getStatsData(id),
  ]);

  const frequency = computeFrequencyStats(statsRaw.reservas);
  const demand = computeDemandStats(statsRaw.reservas, locale);
  const trend = computeTrendStats(statsRaw.reservas);
  const occupancy = computeOccupancyStats(statsRaw.clases, statsRaw.reservas, locale);

  const kpiCards = [
    { label: ta("activeMembers"), value: kpis.activos, icon: UserCheck, color: "text-green-400" },
    { label: ta("expiredMembers"), value: kpis.vencidos, icon: AlertTriangle, color: "text-red-400" },
    { label: ta("pendingMembers"), value: kpis.pendientes, icon: Clock, color: "text-orange-400" },
    { label: "Total", value: kpis.total, icon: Users, color: "text-primary" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/admin-athron/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t("backToDashboard")}
            </Link>
          </Button>
          <h1 className="text-3xl font-black brand-text">{box.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge
              variant={
                box.status === "active"
                  ? "success"
                  : box.status === "trial"
                    ? "warning"
                    : "destructive"
              }
            >
              {t(`status_${box.status}`)}
            </Badge>
            <span className="text-sm text-muted-foreground capitalize">
              {t("plan")}: {box.plan}
            </span>
            <span className="text-sm text-muted-foreground">
              {box.timezone}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("registered")}</p>
            <p className="font-semibold mt-1">
              {formatDate(box.created_at.split("T")[0], locale)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("athletes")}</p>
            <p className="text-2xl font-black mt-1">{box.athleteCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("coaches")}</p>
            <p className="text-2xl font-black mt-1">{box.coachCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("lastAccess")}</p>
            <p className="font-semibold mt-1">
              {box.lastAccess
                ? formatDate(box.lastAccess.split("T")[0], locale)
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-3xl font-black mt-1">{value}</p>
              </div>
              <Icon className={`h-8 w-8 ${color}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("alertsSummary")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("alertsCount", {
            expired: alertas.filter((a) => a.tipo_alerta === "vencida").length,
            expiring: alertas.filter((a) => a.tipo_alerta === "por_vencer").length,
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{ts("frequency")}</CardTitle>
            <CardDescription>{ts("frequencyDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FrequencyChart data={frequency} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{ts("demand")}</CardTitle>
            <CardDescription>{ts("demandDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <DemandChart data={demand} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{ts("occupancy")}</CardTitle>
            <CardDescription>{ts("occupancyDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <OccupancyChart data={occupancy} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{ts("trend")}</CardTitle>
            <CardDescription>{ts("trendDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart data={trend} locale={locale} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
