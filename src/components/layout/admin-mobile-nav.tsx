"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import {
  LayoutDashboard,
  Users,
  UserCog,
  User,
  Calendar,
  CreditCard,
  BarChart3,
  Dumbbell,
  LogOut,
  MoreHorizontal,
  Trophy,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_CONFIG } from "@/lib/config/app-config";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNavProgress } from "./mobile-nav-progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const coachTabs = [
  { href: "/admin/clases", icon: Calendar, key: "classes" },
  { href: "/admin/mis-atletas", icon: Users, key: "athletes" },
  { href: "/admin/mi-perfil", icon: User, key: "profile" },
] as const;

const adminTabs = [
  { href: "/admin/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { href: "/admin/usuarios", icon: Users, key: "users" },
  { href: "/admin/clases", icon: Calendar, key: "classes" },
] as const;

const adminMoreLinks = [
  { href: "/admin/coaches", icon: UserCog, key: "coaches" },
  { href: "/admin/ranking", icon: Trophy, key: "ranking" },
  { href: "/admin/planes", icon: CreditCard, key: "plans" },
  { href: "/admin/estadisticas", icon: BarChart3, key: "stats" },
  { href: "/admin/mi-perfil", icon: User, key: "profile" },
] as const;

function isSameRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getPageTitle(pathname: string, t: (k: string) => string, isCoach: boolean) {
  if (pathname.includes("/clases")) return t("classes");
  if (pathname.includes("/mis-atletas")) return t("athletes");
  if (pathname.includes("/mi-perfil")) return t("profile");
  if (pathname.includes("/dashboard")) return t("dashboard");
  if (pathname.includes("/usuarios")) return t("users");
  if (pathname.includes("/coaches")) return t("coaches");
  if (pathname.includes("/planes")) return t("plans");
  if (pathname.includes("/ranking")) return t("ranking");
  if (pathname.includes("/estadisticas")) return t("stats");
  return isCoach ? "Coach" : "Admin";
}

function AdminMobileNavTab({
  href,
  icon: Icon,
  label,
  active,
  pending,
  navigationLocked,
  onNavigate,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  pending: boolean;
  navigationLocked: boolean;
  onNavigate: (href: string) => void;
}) {
  const highlighted = active || pending;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (active) {
      e.preventDefault();
      return;
    }
    if (navigationLocked) {
      e.preventDefault();
      return;
    }
    onNavigate(href);
  };

  return (
    <Link
      href={href}
      prefetch
      onClick={handleClick}
      className={cn(
        "mobile-bottom-nav-tab relative z-10",
        highlighted
          ? "text-primary bg-primary/10"
          : "text-muted-foreground active:bg-white/5",
        pending && "opacity-80"
      )}
      aria-busy={pending}
      aria-current={active ? "page" : undefined}
    >
      {pending ? (
        <Loader2 className="mobile-bottom-nav-icon animate-spin" aria-hidden />
      ) : (
        <Icon
          className={cn("mobile-bottom-nav-icon", highlighted && "stroke-[2.5]")}
        />
      )}
      <span className="truncate max-w-full text-center">{label}</span>
    </Link>
  );
}

export function AdminMobileNav({
  isCoach = false,
  brandLabel,
}: {
  isCoach?: boolean;
  brandLabel?: string;
}) {
  const t = useTranslations("nav");
  const ta = useTranslations("auth");
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const brand = brandLabel ?? APP_CONFIG.BRAND_NAME;

  const tabs = isCoach ? coachTabs : adminTabs;
  const moreActive = !isCoach && adminMoreLinks.some((l) => isSameRoute(pathname, l.href));
  const navigationLocked = pendingHref !== null;

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const beginNavigation = (href: string) => {
    if (isSameRoute(pathname, href) || pendingHref) return;
    setPendingHref(href);
  };

  const handleMoreLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (isSameRoute(pathname, href)) {
      e.preventDefault();
      setMoreOpen(false);
      return;
    }
    if (navigationLocked) {
      e.preventDefault();
      return;
    }
    setPendingHref(href);
    setMoreOpen(false);
  };

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <>
      <MobileNavProgress visible={pendingHref !== null} />

      <header className="sticky top-0 z-40 w-full shrink-0 border-b border-white/5 bg-background/90 backdrop-blur-md md:hidden safe-top">
        <div className="flex items-center justify-between gap-3 px-4 py-3 safe-top">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl brand-gradient">
              <Dumbbell className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-black text-xs tracking-wider uppercase brand-text truncate">
                {brand}
              </p>
              <p className="text-sm font-semibold truncate">
                {getPageTitle(pathname, t, isCoach)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher />
            {isCoach && (
              <button
                type="button"
                onClick={logout}
                className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                aria-label={ta("logout")}
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 isolate border-t border-white/5 bg-card/95 backdrop-blur-md pointer-events-auto md:hidden safe-bottom"
        aria-label="Navegación principal"
      >
        <div className="mobile-bottom-nav flex items-stretch justify-around gap-0.5 px-1 sm:px-1.5">
          {tabs.map(({ href, icon: Icon, key }) => (
            <AdminMobileNavTab
              key={href}
              href={href}
              icon={Icon}
              label={t(key)}
              active={isSameRoute(pathname, href)}
              pending={pendingHref === href}
              navigationLocked={navigationLocked}
              onNavigate={beginNavigation}
            />
          ))}

          {!isCoach && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              disabled={navigationLocked}
              className={cn(
                "mobile-bottom-nav-tab relative z-10",
                moreActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground active:bg-white/5",
                navigationLocked && "opacity-60"
              )}
            >
              <MoreHorizontal
                className={cn(
                  "mobile-bottom-nav-icon",
                  moreActive && "stroke-[2.5]"
                )}
              />
              <span className="truncate max-w-full text-center">Más</span>
            </button>
          )}
        </div>
      </nav>

      {!isCoach && (
        <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Menú</DialogTitle>
            </DialogHeader>
            <div className="space-y-1">
              {adminMoreLinks.map(({ href, icon: Icon, key }) => {
                const active = isSameRoute(pathname, href);
                const pending = pendingHref === href;

                return (
                  <Link
                    key={href}
                    href={href}
                    prefetch
                    onClick={(e) => handleMoreLinkClick(e, href)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-colors min-h-[48px]",
                      active || pending
                        ? "bg-primary/15 text-primary"
                        : "hover:bg-white/5",
                      pending && "opacity-80"
                    )}
                    aria-busy={pending}
                  >
                    {pending ? (
                      <Loader2 className="h-6 w-6 shrink-0 animate-spin" />
                    ) : (
                      <Icon className="h-6 w-6 shrink-0" />
                    )}
                    {t(key)}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground min-h-[48px]"
              >
                <LogOut className="h-6 w-6 shrink-0" />
                {ta("logout")}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
