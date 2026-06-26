"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { Calendar, User, CreditCard, Dumbbell, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_CONFIG } from "@/lib/config/app-config";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "./language-switcher";

const links = [
  { href: "/mis-reservas", icon: Calendar, key: "myBookings" },
  { href: "/mi-membresia", icon: CreditCard, key: "membership" },
  { href: "/perfil", icon: User, key: "profile" },
] as const;

function getPageTitle(pathname: string, t: (k: string) => string) {
  if (pathname.includes("/mis-reservas")) return t("myBookings");
  if (pathname.includes("/mi-membresia")) return t("membership");
  if (pathname.includes("/perfil")) return t("profile");
  return APP_CONFIG.BRAND_NAME;
}

export function SocioDesktopSidebar() {
  const t = useTranslations("nav");
  const ta = useTranslations("auth");
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-white/5 min-h-screen p-4">
      <div className="flex items-center gap-3 px-3 py-2 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg brand-gradient">
          <Dumbbell className="h-4 w-4 text-white" />
        </div>
        <span className="font-black text-xs tracking-wider uppercase brand-text">
          {APP_CONFIG.BRAND_NAME}
        </span>
      </div>
      <nav className="flex-1 space-y-1">
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
      </nav>
      <button
        onClick={logout}
        className="mt-4 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        {ta("logout")}
      </button>
    </aside>
  );
}

export function SocioMobileNav() {
  const t = useTranslations("nav");
  const ta = useTranslations("auth");
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full shrink-0 border-b border-white/5 bg-background/90 backdrop-blur-md md:hidden safe-top">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl brand-gradient">
              <Dumbbell className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-black text-xs tracking-wider uppercase brand-text truncate">
                {APP_CONFIG.BRAND_NAME}
              </p>
              <p className="text-sm font-semibold truncate">
                {getPageTitle(pathname, t)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={logout}
              className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground"
              aria-label={ta("logout")}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/5 bg-card/95 backdrop-blur-md md:hidden safe-bottom">
        <div className="flex items-stretch justify-around px-1 pt-1.5 pb-1">
          {links.map(({ href, icon: Icon, key }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                <span className="truncate max-w-full">{t(key)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

/** @deprecated Use SocioDesktopSidebar + SocioMobileNav in layout */
export function SocioNav() {
  return (
    <>
      <SocioMobileNav />
      <SocioDesktopSidebar />
    </>
  );
}
