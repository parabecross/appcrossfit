import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { daysUntilDateOnly } from "@/lib/dates/date-only";
import { formatDate, cn } from "@/lib/utils";
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
  locale,
}: {
  profile: Profile;
  membership: MembresiaWithPlan | null;
  today: string;
  locale: string;
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

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("label")}
        </h2>
        <Link
          href="/mi-membresia"
          className="min-h-11 inline-flex items-center text-xs font-semibold text-orange-400 hover:text-orange-300"
        >
          {t("viewMembership")}
        </Link>
      </div>
      <div
        className={cn(
          "rounded-xl border px-3 py-3 space-y-1.5",
          tone === "danger" && "border-red-500/20 bg-red-500/[0.04]",
          tone === "warning" && "border-orange-500/15 bg-orange-500/[0.03]",
          tone === "success" && "border-white/10 bg-white/[0.03]",
          tone === "muted" && "border-white/10 bg-white/[0.03]"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold truncate">{planName}</p>
          {badgeLabel && badgeVariant ? (
            <Badge variant={badgeVariant} className="shrink-0 text-[10px]">
              {badgeLabel}
            </Badge>
          ) : null}
        </div>
        {membership?.fecha_fin ? (
          <p className="text-xs text-muted-foreground">
            {t("expires")}: {formatDate(membership.fecha_fin, locale)}
          </p>
        ) : null}
        {daysLeft !== null && daysLeft >= 0 ? (
          <p
            className={cn(
              "text-xs text-muted-foreground",
              daysLeft <= 7 && "text-orange-400"
            )}
          >
            {t("daysLeft", { days: daysLeft })}
          </p>
        ) : !membership && !isPendingPayment ? (
          <p className="text-xs text-muted-foreground">{t("none")}</p>
        ) : null}
      </div>
    </section>
  );
}
