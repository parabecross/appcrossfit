"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { Calendar, User, CreditCard, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_CONFIG } from "@/lib/config/app-config";

const links = [
  { href: "/mis-reservas", icon: Calendar, key: "myBookings" },
  { href: "/mi-membresia", icon: CreditCard, key: "membership" },
  { href: "/perfil", icon: User, key: "profile" },
] as const;

export function SocioNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/5 bg-background/80 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg brand-gradient">
            <Dumbbell className="h-4 w-4 text-white" />
          </div>
          <span className="font-black text-sm tracking-wider uppercase brand-text">
            {APP_CONFIG.BRAND_NAME}
          </span>
        </div>
      </header>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/5 bg-card/95 backdrop-blur-md md:hidden">
        <div className="flex justify-around py-2">
          {links.map(({ href, icon: Icon, key }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium",
                pathname.startsWith(href)
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {t(key)}
            </Link>
          ))}
        </div>
      </nav>
      <aside className="hidden md:flex w-56 flex-col border-r border-white/5 min-h-screen p-4 gap-1">
        {links.map(({ href, icon: Icon, key }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
              pathname.startsWith(href)
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-white/5"
            )}
          >
            <Icon className="h-4 w-4" />
            {t(key)}
          </Link>
        ))}
      </aside>
    </>
  );
}
