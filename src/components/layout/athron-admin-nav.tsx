"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { LayoutDashboard, Dumbbell, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_CONFIG } from "@/lib/config/app-config";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

const links = [
  { href: "/admin-athron/dashboard", icon: LayoutDashboard, key: "dashboard" },
] as const;

export function AthronAdminSidebar() {
  const t = useTranslations("athronAdmin");
  const ta = useTranslations("auth");
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-white/5 bg-card/50 min-h-screen">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg brand-gradient">
            <Dumbbell className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-black text-sm tracking-wider uppercase brand-text">
              {APP_CONFIG.BRAND_NAME}
            </p>
            <p className="text-xs text-muted-foreground">{t("superAdmin")}</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ href, icon: Icon, key }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {t(key)}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-white/5 space-y-2">
        <LanguageSwitcher />
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          {ta("logout")}
        </button>
      </div>
    </aside>
  );
}

export function AthronAdminMobileHeader() {
  const t = useTranslations("athronAdmin");
  const ta = useTranslations("auth");
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
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
            <p className="text-sm font-semibold truncate">{t("superAdmin")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={logout}
            className="rounded-lg p-2 text-muted-foreground hover:bg-white/5"
            aria-label={ta("logout")}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
