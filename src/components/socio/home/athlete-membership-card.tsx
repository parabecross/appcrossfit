import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { daysUntilDateOnly } from "@/lib/dates/date-only";
import { cn } from "@/lib/utils";
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

export async function AthleteMembershipCard({
  profile,
  membership,
  today,
}: {
  profile: Profile;
  membership: MembresiaWithPlan | null;
  today: string;
}) {
  const t = await getTranslations("socioHome.membership");
  const tm = await getTranslations("membership.status");
  const tone = cardTone(profile, membership, today);
  const daysLeft =
    membership?.estado === "vigente"
      ? daysUntilDateOnly(membership.fecha_fin, today)
      : null;

  const planName = membership?.plan?.nombre ?? t("none");
  const isPendingPayment = profile.estado_cuenta === "pendiente_pago";

  const badgeVariant =
    !membership && isPendingPayment
      ? ("warning" as const)
      : membership?.estado === "vigente"
        ? tone === "warning"
          ? ("warning" as const)
          : ("success" as const)
        : membership
          ? ("destructive" as const)
          : null;

  const badgeLabel =
    !membership && isPendingPayment
      ? t("pendingPayment")
      : membership
        ? tm(membership.estado)
        : null;

  const footerText =
    daysLeft !== null && daysLeft >= 0
      ? t("daysLeft", { days: daysLeft })
      : !membership && !isPendingPayment
        ? t("none")
        : null;

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 md:rounded-2xl md:px-4 md:py-3",
        tone === "danger" && "border-red-500/20 bg-red-500/[0.04]",
        tone === "warning" && "border-orange-500/15 bg-orange-500/[0.03]",
        tone === "success" && "border-white/8 bg-white/[0.02]",
        tone === "muted" && "border-white/8 bg-white/[0.02]"
      )}
    >
      <p className="text-xs text-muted-foreground">{t("label")}</p>

      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold truncate">{planName}</p>
        {badgeLabel && badgeVariant && (
          <Badge variant={badgeVariant} className="shrink-0 text-[10px]">
            {badgeLabel}
          </Badge>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        {footerText ? (
          <p
            className={cn(
              "text-xs text-muted-foreground",
              daysLeft !== null && daysLeft <= 7 && "text-orange-400"
            )}
          >
            {footerText}
          </p>
        ) : (
          <span />
        )}
        <Link
          href="/mi-membresia"
          className="shrink-0 text-[11px] font-medium text-primary hover:underline"
        >
          {t("viewMembership")}
        </Link>
      </div>
    </div>
  );
}
