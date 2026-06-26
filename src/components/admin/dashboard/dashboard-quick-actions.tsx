import { Link } from "@/i18n/routing";
import {
  CalendarPlus,
  CreditCard,
  UserPlus,
  Users,
} from "lucide-react";

export function DashboardQuickActions({
  labels,
}: {
  labels: {
    newClass: string;
    newAthlete: string;
    newCoach: string;
    assignMembership: string;
  };
}) {
  const actions = [
    {
      href: "/admin/clases",
      label: labels.newClass,
      icon: CalendarPlus,
    },
    {
      href: "/admin/usuarios",
      label: labels.newAthlete,
      icon: UserPlus,
    },
    {
      href: "/admin/coaches",
      label: labels.newCoach,
      icon: Users,
    },
    {
      href: "/admin/usuarios",
      label: labels.assignMembership,
      icon: CreditCard,
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {actions.map(({ href, label, icon: Icon }) => (
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
