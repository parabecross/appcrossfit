"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./language-switcher";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/routing";
import { APP_CONFIG } from "@/lib/config/app-config";

const coachLinks = [
  { href: "/admin/clases", icon: Calendar, key: "classes" },
  { href: "/admin/mi-perfil", icon: User, key: "profile" },
] as const;

const links = [
  { href: "/admin/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { href: "/admin/usuarios", icon: Users, key: "users" },
  { href: "/admin/coaches", icon: UserCog, key: "coaches" },
  { href: "/admin/clases", icon: Calendar, key: "classes" },
  { href: "/admin/planes", icon: CreditCard, key: "plans" },
  { href: "/admin/estadisticas", icon: BarChart3, key: "stats" },
] as const;

export function AdminSidebar({ isCoach = false }: { isCoach?: boolean }) {
  const t = useTranslations("nav");
  const ta = useTranslations("auth");
  const pathname = usePathname();
  const router = useRouter();

  const visibleLinks = isCoach ? coachLinks : links;

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
            <p className="text-xs text-muted-foreground">
              {isCoach ? "Coach" : "Admin"}
            </p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {visibleLinks.map(({ href, icon: Icon, key }) => (
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
