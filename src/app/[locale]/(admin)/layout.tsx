import { requireRole } from "@/lib/auth/get-profile";
import { getBoxConfig } from "@/lib/box/config";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminMobileNav } from "@/components/layout/admin-mobile-nav";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { DailyMotivationBanner } from "@/components/layout/daily-motivation-banner";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireRole(locale, ["admin", "coach", "box_admin"]);
  const boxConfig = await getBoxConfig(profile.box_id);

  return (
    <div className="flex min-h-screen mobile-page w-full overflow-x-hidden">
      <AdminSidebar
        isCoach={profile.rol === "coach"}
        brandLabel={boxConfig.name}
        showAthronLink={profile.is_super_admin === true}
      />
      <div className="flex flex-1 flex-col min-h-screen min-w-0 w-full">
        <AdminMobileNav
          isCoach={profile.rol === "coach"}
          brandLabel={boxConfig.name}
        />
        <header className="hidden md:flex items-center justify-end border-b border-white/5 px-6 py-3 shrink-0">
          <LanguageSwitcher />
        </header>
        <main className="flex-1 w-full px-4 py-4 md:p-8 md:max-w-6xl md:mx-auto overflow-x-hidden">
          <DailyMotivationBanner audience="coach" locale={locale} className="mb-5" />
          {children}
        </main>
      </div>
    </div>
  );
}
