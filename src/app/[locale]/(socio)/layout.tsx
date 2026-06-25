import { requireRole } from "@/lib/auth/get-profile";
import { SocioNav } from "@/components/layout/socio-nav";
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
    <div className="flex min-h-screen pb-20 md:pb-0">
      <SocioNav />
      <div className="flex-1 flex flex-col">
        <header className="hidden md:flex items-center justify-end border-b border-white/5 px-6 py-3">
          <LanguageSwitcher />
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
