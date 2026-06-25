import { requireRole } from "@/lib/auth/get-profile";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
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
    <div className="flex min-h-screen">
      <AdminSidebar isCoach={profile.rol === "coach"} />
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="hidden md:flex items-center justify-end border-b border-white/5 px-6 py-3">
          <LanguageSwitcher />
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
