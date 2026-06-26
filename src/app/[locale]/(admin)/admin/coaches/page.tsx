import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth/get-profile";
import { getCoachesWithEmail } from "@/lib/queries/coaches";
import { CoachesAdmin } from "@/components/admin/coaches-admin";

export default async function AdminCoachesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale);
  const t = await getTranslations("admin");
  const coaches = await getCoachesWithEmail();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black brand-text">{t("coachesTitle")}</h1>
        <p className="text-muted-foreground mt-1">{t("coachesSubtitle")}</p>
      </div>
      <CoachesAdmin coaches={coaches} locale={locale} />
    </div>
  );
}
