import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth/get-profile";
import { getAdminDashboardData } from "@/lib/queries/admin-dashboard";
import { ActivityFeedExplorer } from "@/components/admin/actividad/activity-feed-explorer";

export default async function AdminActividadPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdmin(locale);
  const td = await getTranslations("adminDashboard");

  const data = await getAdminDashboardData(undefined, locale);

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-black brand-text">
          {td("activity.pageTitle")}
        </h1>
        <p className="text-muted-foreground mt-2">
          {td("activity.pageSubtitle")}
        </p>
      </div>

      <ActivityFeedExplorer
        events={data.recentActivity}
        today={data.today}
        locale={locale}
        labels={{
          title: td("today.title"),
          subtitle: td("today.subtitle"),
          empty: td("today.empty"),
          searchPlaceholder: td("activity.searchPlaceholder"),
          noResults: td("activity.noResults"),
          today: td("today.todayLabel"),
          yesterday: td("today.yesterdayLabel"),
          types: {
            reserva: td("today.types.reserva"),
            asistencia: td("today.types.asistencia"),
            pr: td("today.types.pr"),
            skill: td("today.types.skill"),
            membresia: td("today.types.membresia"),
          },
        }}
      />
    </div>
  );
}
