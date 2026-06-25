import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function EstadisticasPage() {
  const ts = await getTranslations("stats");
  const { reservas, clases } = await getStatsData();

  const frequency = computeFrequencyStats(reservas);
  const demand = computeDemandStats(reservas);
  const trend = computeTrendStats(reservas);
  const occupancy = computeOccupancyStats(clases, reservas);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-black brand-text">{ts("title")}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{ts("frequency")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FrequencyChart data={frequency} />
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
        <Card>
          <CardHeader>
            <CardTitle>{ts("occupancy")}</CardTitle>
          </CardHeader>
          <CardContent>
            <OccupancyChart data={occupancy} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{ts("trend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={trend} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
