import { requireRole } from "@/lib/auth/get-profile";
import {
  SocioDesktopSidebar,
  SocioMobileNav,
} from "@/components/layout/socio-nav";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { createClient } from "@/lib/supabase/server";

export default async function SocioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireRole(locale, ["socio"]);

  const supabase = await createClient();
  await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen mobile-page w-full overflow-x-hidden">
      <SocioDesktopSidebar />
      <div className="flex flex-1 flex-col min-w-0 w-full">
        <SocioMobileNav />
        <header className="hidden md:flex items-center justify-end border-b border-white/5 px-6 py-3 shrink-0">
          <LanguageSwitcher />
        </header>
        <main className="flex-1 w-full px-4 py-4 md:p-8 md:max-w-2xl md:mx-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
