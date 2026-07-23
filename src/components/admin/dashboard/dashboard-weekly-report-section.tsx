import { getTranslations } from "next-intl/server";
import { getBoxConfig } from "@/lib/box/get-box-config";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { canUseFeature } from "@/lib/entitlements/permissions";
import { getCurrentWeekRange, getTodayInBox } from "@/lib/reporte-semanal/week-range";
import { DashboardWeeklyReportCard } from "@/components/admin/dashboard/dashboard-weekly-report-card";

export async function DashboardWeeklyReportSection({
  boxId,
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

  const defaults = getCurrentWeekRange(box.timezone);
  const today = getTodayInBox(box.timezone);

  return (
    <DashboardWeeklyReportCard
      defaultFrom={defaults.from}
      defaultTo={defaults.to}
      maxDate={today}
      timeZone={box.timezone}
      labels={{
        title: td("weeklyReport.title"),
        description: td("weeklyReport.description"),
        fromLabel: td("weeklyReport.from"),
        toLabel: td("weeklyReport.to"),
        download: td("weeklyReport.download"),
        downloading: td("weeklyReport.downloading"),
        error: td("weeklyReport.error"),
        emptyHint: td("weeklyReport.emptyHint"),
        periodInvalid: td("weeklyReport.periodInvalid"),
        rangeTooLong: td("weeklyReport.rangeTooLong"),
        rangeInverted: td("weeklyReport.rangeInverted"),
        rangeFuture: td("weeklyReport.rangeFuture"),
      }}
    />
  );
}
