import { getTranslations } from "next-intl/server";
import { getBoxConfig } from "@/lib/box/get-box-config";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { canUseFeature } from "@/lib/entitlements/permissions";
import {
  formatWeekRangeForReport,
  getCurrentWeekRange,
} from "@/lib/reporte-semanal";
import { DashboardWeeklyReportCard } from "@/components/admin/dashboard/dashboard-weekly-report-card";

export async function DashboardWeeklyReportSection({
  boxId,
}: {
  boxId: string;
}) {
  const entitlements = await getBoxEntitlements(boxId);
  if (!canUseFeature(entitlements, "resumen_semanal")) {
    return null;
  }

  const [box, td] = await Promise.all([
    getBoxConfig(boxId),
    getTranslations("adminDashboard"),
  ]);

  const week = getCurrentWeekRange(box.timezone);
  const weekLabel = formatWeekRangeForReport(week, "es");

  return (
    <DashboardWeeklyReportCard
      weekLabel={weekLabel}
      labels={{
        title: td("weeklyReport.title"),
        description: td("weeklyReport.description"),
        periodLabel: td("weeklyReport.period"),
        download: td("weeklyReport.download"),
        downloading: td("weeklyReport.downloading"),
        error: td("weeklyReport.error"),
        emptyHint: td("weeklyReport.emptyHint"),
      }}
    />
  );
}
