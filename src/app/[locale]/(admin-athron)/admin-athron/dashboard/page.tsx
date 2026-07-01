import { getTranslations } from "next-intl/server";
import { requireSuperAdmin } from "@/lib/auth/get-profile";
import { getAllBoxesWithStats } from "@/lib/queries/athron-admin";
import { AthronBoxesTable } from "@/components/athron/boxes-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";

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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight brand-text">
          {t("dashboard")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("dashboardDesc")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t("totalBoxes")}</p>
              <p className="text-3xl font-black mt-1">{boxes.length}</p>
            </div>
            <Building2 className="h-8 w-8 text-primary opacity-80" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("activeBoxes")}</p>
            <p className="text-3xl font-black mt-1 text-green-400">{active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("trialBoxes")}</p>
            <p className="text-3xl font-black mt-1 text-orange-400">{trial}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("boxesTable")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-visible">
          <AthronBoxesTable boxes={boxes} locale={locale} />
        </CardContent>
      </Card>
    </div>
  );
}
