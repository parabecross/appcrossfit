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
    <div className="flex min-h-screen mobile-page">
      <AdminSidebar isCoach={profile.rol === "coach"} />
      <AdminMobileNav isCoach={profile.rol === "coach"} />
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="hidden md:flex items-center justify-end border-b border-white/5 px-6 py-3">
          <LanguageSwitcher />
        </header>
        <main className="flex-1 px-4 py-4 md:p-8 overflow-auto max-w-6xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
