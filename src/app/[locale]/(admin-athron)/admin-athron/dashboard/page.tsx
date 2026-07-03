import { getTranslations } from "next-intl/server";

import { requireSuperAdmin } from "@/lib/auth/get-profile";
import { getAllBoxesWithStats } from "@/lib/queries/athron-admin";
import { AthronBoxesTable } from "@/components/athron/boxes-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AthronDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireSuperAdmin(locale);
  const t = await getTranslations("athronAdmin");

  const boxes = await getAllBoxesWithStats();
  const active = boxes.filter((b) => b.status === "active").length;
  const trial = boxes.filter((b) => b.status === "trial").length;

  return (
    <div className="space-y-4 md:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight brand-text">
          {t("dashboard")}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          {t("dashboardDesc")}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-6 sm:pt-6 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-sm text-muted-foreground leading-tight">
                {t("totalBoxes")}
              </p>
              <p className="text-2xl sm:text-3xl font-black mt-1">{boxes.length}</p>
            </div>
            <Building2 className="hidden sm:block h-8 w-8 shrink-0 text-primary opacity-80" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6 sm:pt-6">
            <p className="text-[10px] sm:text-sm text-muted-foreground leading-tight">
              {t("activeBoxes")}
            </p>
            <p className="text-2xl sm:text-3xl font-black mt-1 text-green-400">
              {active}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6 sm:pt-6">
            <p className="text-[10px] sm:text-sm text-muted-foreground leading-tight">
              {t("trialBoxes")}
            </p>
            <p className="text-2xl sm:text-3xl font-black mt-1 text-orange-400">
              {trial}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg">{t("boxesTable")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 overflow-hidden">
          <AthronBoxesTable boxes={boxes} locale={locale} />
        </CardContent>
      </Card>
    </div>
  );
}
