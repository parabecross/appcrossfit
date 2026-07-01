import { Link } from "@/i18n/routing";
import {
  CalendarPlus,
  CreditCard,
  UserPlus,
  Users,
} from "lucide-react";
import type { FeatureKey } from "@/lib/entitlements/features";
import { canUseFeature } from "@/lib/entitlements/permissions";
import type { BoxEntitlements } from "@/lib/entitlements/types";

export function DashboardQuickActions({
  entitlements,
  labels,
}: {
  entitlements: BoxEntitlements;
  labels: {
    newClass: string;
    newAthlete: string;
    newCoach: string;
    assignMembership: string;
  };
}) {
  const actions: {
    href: string;
    label: string;
    icon: typeof CalendarPlus;
    feature: FeatureKey;
  }[] = [
    {
      href: "/admin/clases",
      label: labels.newClass,
      icon: CalendarPlus,
      feature: "clases",
    },
    {
      href: "/admin/usuarios",
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
      href: "/admin/usuarios",
      label: labels.assignMembership,
      icon: CreditCard,
      feature: "membresias",
    },
  ];

  const visible = actions.filter((action) =>
    canUseFeature(entitlements, action.feature)
  );

  if (visible.length === 0) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {visible.map(({ href, label, icon: Icon }) => (
        <Link
          key={label}
          href={href}
          className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 transition-all hover:border-orange-500/30 hover:bg-orange-500/5"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400 group-hover:bg-orange-500/25">
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold leading-tight">{label}</span>
        </Link>
      ))}
    </div>
  );
}
