import { requireRole } from "@/lib/auth/get-profile";

import { getBoxConfig } from "@/lib/box/config";
import {
  SocioDesktopSidebar,
  SocioMobileNav,
} from "@/components/layout/socio-nav";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { SocioTopBanner } from "@/components/layout/socio-top-banner";
import { InstallAppPrompt } from "@/components/pwa/install-app-prompt";
import { buildBirthdayGreeting } from "@/lib/birthdays/helpers";
import { todayInTimezone } from "@/lib/dates/date-only";
import { getOwnBirthdayToday } from "@/lib/queries/birthdays";

export const dynamic = "force-dynamic";

export default async function SocioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await requireRole(locale, ["socio"]);
  const boxConfig = await getBoxConfig(profile.box_id);
  const today = todayInTimezone(boxConfig.timezone);

  const { isToday, age } = await getOwnBirthdayToday(
    profile.id,
    boxConfig.timezone
  );
  const birthdayGreeting = isToday
    ? buildBirthdayGreeting(profile.nombre_completo, locale, age)
    : null;

  return (
    <div className="flex min-h-screen mobile-page w-full overflow-x-hidden">
      <SocioDesktopSidebar brandLabel={boxConfig.name} />
      <div className="flex flex-1 flex-col min-w-0 w-full">
        <SocioMobileNav brandLabel={boxConfig.name} />
        <header className="hidden md:flex items-center justify-end border-b border-white/5 px-6 py-3 shrink-0">
          <LanguageSwitcher />
        </header>
        <main className="flex-1 w-full px-4 py-3 md:p-8 md:max-w-4xl md:mx-auto overflow-x-hidden pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8">
          <SocioTopBanner
            locale={locale}
            today={today}
            birthdayGreeting={birthdayGreeting}
          />
          {children}
        </main>
        <InstallAppPrompt />
      </div>
    </div>
  );
}
