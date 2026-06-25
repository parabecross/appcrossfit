import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth/get-profile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getStatsData,
  computeFrequencyStats,
  computeDemandStats,
  computeTrendStats,
  computeOccupancyStats,
} from "@/lib/queries/stats";
import {
  FrequencyChart,
  DemandChart,
  TrendChart,
  OccupancyChart,
} from "@/components/stats/charts";

export default async function EstadisticasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale);
  const ts = await getTranslations("stats");
  const { reservas, clases } = await getStatsData();

  const frequency = computeFrequencyStats(reservas);
  const demand = computeDemandStats(reservas, locale);
  const trend = computeTrendStats(reservas);
  const occupancy = computeOccupancyStats(clases, reservas, locale);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-black brand-text">{ts("title")}</h1>

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
