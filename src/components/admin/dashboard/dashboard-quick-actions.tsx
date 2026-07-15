import { Link } from "@/i18n/routing";
import {
  CalendarPlus,
  CreditCard,
  UserPlus,
  Users,
  UserRoundSearch,
} from "lucide-react";
import type { FeatureKey } from "@/lib/entitlements/features";
import { canUseFeature } from "@/lib/entitlements/permissions";
import type { BoxEntitlements } from "@/lib/entitlements/types";
import { USUARIOS_DEEP_LINKS } from "@/lib/admin/usuarios-filters";

export function DashboardQuickActions({
  entitlements,
  labels,
}: {
  entitlements?: BoxEntitlements;
  labels: {
    newClass: string;
    newAthlete: string;
    newCoach: string;
    assignMembership: string;
    needsAttention: string;
  };
}) {
  const actions: {
    href: string;
    label: string;
    icon: typeof CalendarPlus;
    feature: FeatureKey | null;
  }[] = [
    {
      href: "/admin/clases",
      label: labels.newClass,
      icon: CalendarPlus,
      feature: "clases",
    },
    {
      href: USUARIOS_DEEP_LINKS.newAthlete,
      label: labels.newAthlete,
      icon: UserPlus,
      feature: "membresias",
    },
    {
      href: "/admin/coaches",
      label: labels.newCoach,
      icon: Users,
      feature: "membresias",
    },
    {
      href: USUARIOS_DEEP_LINKS.assignMembership,
      label: labels.assignMembership,
      icon: CreditCard,
      feature: "membresias",
    },
    {
      href: USUARIOS_DEEP_LINKS.needsAttention,
      label: labels.needsAttention,
      icon: UserRoundSearch,
      feature: null,
    },
  ];

  const visible = entitlements
    ? actions.filter(
        (action) =>
          action.feature == null ||
          canUseFeature(entitlements, action.feature)
      )
    : actions;

  if (visible.length === 0) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
      {visible.map(({ href, label, icon: Icon }) => (
        <Link
          key={label}
          href={href}
          className="group flex min-h-11 items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2.5 transition-all hover:bg-orange-500/5"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/12 text-orange-400 group-hover:bg-orange-500/20">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold leading-tight">{label}</span>
        </Link>
      ))}
    </div>
  );
}
