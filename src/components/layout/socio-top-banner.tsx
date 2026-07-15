"use client";

import { usePathname } from "@/i18n/routing";
import { DailyMotivationBanner } from "@/components/layout/daily-motivation-banner";

/**
 * On Home (/mis-reservas) we only keep birthday greetings —
 * never random motivational copy (Home has its own contextual status line).
 */
export function SocioTopBanner({
  locale,
  today,
  birthdayGreeting,
}: {
  locale: string;
  today: string;
  birthdayGreeting: string | null;
}) {
  const pathname = usePathname();
  const isHome = pathname.includes("/mis-reservas");

  if (isHome && !birthdayGreeting) return null;

  return (
    <>
      <DailyMotivationBanner
        audience="athlete"
        locale={locale}
        today={today}
        birthdayGreeting={birthdayGreeting}
        compact
        className="mb-3 md:hidden"
      />
      <DailyMotivationBanner
        audience="athlete"
        locale={locale}
        today={today}
        birthdayGreeting={birthdayGreeting}
        className="mb-5 hidden md:block"
      />
    </>
  );
}
