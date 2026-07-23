import { getTranslations } from "next-intl/server";
import { getBoxConfig } from "@/lib/box/get-box-config";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { canUseFeature } from "@/lib/entitlements/permissions";
import { listRecentWeekOptions } from "@/lib/reporte-semanal/week-range";
import { DashboardWeeklyReportCard } from "@/components/admin/dashboard/dashboard-weekly-report-card";

export async function DashboardWeeklyReportSection({
  boxId,
  locale = "es",
}: {
  boxId: string;
  locale?: string;
}) {
  const entitlements = await getBoxEntitlements(boxId);
  if (!canUseFeature(entitlements, "resumen_semanal")) {
    return null;
  }

  const [box, td] = await Promise.all([
    getBoxConfig(boxId),
    getTranslations("adminDashboard"),
  ]);

  const weeks = listRecentWeekOptions(box.timezone, locale, 12);

  return (
    <DashboardWeeklyReportCard
      weeks={weeks}
      labels={{
        title: td("weeklyReport.title"),
        description: td("weeklyReport.description"),
        periodLabel: td("weeklyReport.period"),
        selectPeriod: td("weeklyReport.selectPeriod"),
        thisWeekSuffix: td("weeklyReport.thisWeekSuffix"),
        download: td("weeklyReport.download"),
        downloading: td("weeklyReport.downloading"),
        error: td("weeklyReport.error"),
        emptyHint: td("weeklyReport.emptyHint"),
        periodInvalid: td("weeklyReport.periodInvalid"),
      }}
    />
  );
}
