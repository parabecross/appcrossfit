import { requireRole } from "@/lib/auth/get-profile";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminMobileNav } from "@/components/layout/admin-mobile-nav";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireRole(locale, ["admin", "coach"]);

  return (
    <div className="flex min-h-screen mobile-page w-full overflow-x-hidden">
      <AdminSidebar isCoach={profile.rol === "coach"} />
      <div className="flex flex-1 flex-col min-h-screen min-w-0 w-full">
        <AdminMobileNav isCoach={profile.rol === "coach"} />
        <header className="hidden md:flex items-center justify-end border-b border-white/5 px-6 py-3 shrink-0">
          <LanguageSwitcher />
        </header>
        <main className="flex-1 w-full px-4 py-4 md:p-8 md:max-w-6xl md:mx-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
