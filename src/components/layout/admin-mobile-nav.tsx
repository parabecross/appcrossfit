"use client";

import { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_CONFIG } from "@/lib/config/app-config";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "./language-switcher";
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
  const brand = brandLabel ?? APP_CONFIG.BRAND_NAME;

  const tabs = isCoach ? coachTabs : adminTabs;
  const moreActive = !isCoach && adminMoreLinks.some((l) => pathname.startsWith(l.href));

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <>
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

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/5 bg-card/95 backdrop-blur-md md:hidden safe-bottom">
        <div className="flex items-stretch justify-around px-1 pt-1.5 pb-1">
          {tabs.map(({ href, icon: Icon, key }) => {
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

          {!isCoach && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors",
                moreActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <MoreHorizontal className={cn("h-5 w-5", moreActive && "stroke-[2.5]")} />
              <span>Más</span>
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
              {adminMoreLinks.map(({ href, icon: Icon, key }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                    pathname.startsWith(href)
                      ? "bg-primary/15 text-primary"
                      : "hover:bg-white/5"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {t(key)}
                </Link>
              ))}
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground"
              >
                <LogOut className="h-5 w-5" />
                {ta("logout")}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
