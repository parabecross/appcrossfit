import { getTranslations } from "next-intl/server";
import { CalendarDays, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { daysUntilDateOnly } from "@/lib/dates/date-only";
import { formatDate } from "@/lib/utils";
import type { MembresiaWithPlan } from "@/lib/queries/memberships";
import type { Profile } from "@/types/database";

function cardTone(
  profile: Profile,
  membership: MembresiaWithPlan | null,
  today: string
): "success" | "warning" | "danger" | "muted" {
  if (profile.estado_cuenta === "pendiente_pago") return "warning";
  if (!membership) return "muted";
  if (membership.estado === "vencida") return "danger";
  const days = daysUntilDateOnly(membership.fecha_fin, today);
  if (days <= 7) return "warning";
  return "success";
}

const toneStyles = {
  success:
    "border-green-500/25 bg-gradient-to-br from-green-500/[0.08] to-card/60",
  warning:
    "border-orange-500/25 bg-gradient-to-br from-orange-500/[0.08] to-card/60",
  danger:
    "border-red-500/25 bg-gradient-to-br from-red-500/[0.08] to-card/60",
  muted: "border-white/10 bg-card/50",
};

export async function AthleteMembershipCard({
  profile,
  membership,
  locale,
  today,
}: {
  profile: Profile;
  membership: MembresiaWithPlan | null;
  locale: string;
  today: string;
}) {
  const t = await getTranslations("socioHome.membership");
  const tm = await getTranslations("membership.status");
  const tone = cardTone(profile, membership, today);
  const daysLeft =
    membership?.estado === "vigente"
      ? daysUntilDateOnly(membership.fecha_fin, today)
      : null;

  return (
    <div className={`rounded-2xl border p-5 ${toneStyles[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("label")}
            </p>
            {membership ? (
              <>
                <p className="text-lg font-bold mt-0.5 truncate">
                  {membership.plan?.nombre ?? "—"}
                </p>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  {t("expires")}: {formatDate(membership.fecha_fin, locale)}
                </p>
              </>
            ) : (
              <p className="text-base font-semibold mt-1 text-muted-foreground">
                {t("none")}
              </p>
            )}
          </div>
        </div>
        {membership && (
          <Badge
            variant={
              membership.estado === "vigente"
                ? tone === "warning"
                  ? "warning"
                  : "success"
                : "destructive"
            }
            className="shrink-0"
          >
            {tm(membership.estado)}
          </Badge>
        )}
        {profile.estado_cuenta === "pendiente_pago" && !membership && (
          <Badge variant="warning" className="shrink-0">
            {t("pendingPayment")}
          </Badge>
        )}
      </div>
      {daysLeft !== null && daysLeft >= 0 && (
        <p
          className={`mt-3 text-sm font-medium rounded-xl px-3 py-2 inline-block ${
            daysLeft <= 7
              ? "bg-orange-500/15 text-orange-300"
              : "bg-white/5 text-muted-foreground"
          }`}
        >
          {t("daysLeft", { days: daysLeft })}
        </p>
      )}
    </div>
  );
}
