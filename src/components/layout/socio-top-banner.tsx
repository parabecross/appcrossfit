"use client";

import { DailyMotivationBanner } from "@/components/layout/daily-motivation-banner";

/**
 * Frase motivadora diaria del atleta (o saludo de cumpleaños si aplica).
 * Se muestra en todas las rutas socio, incluida Mis reservas.
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
