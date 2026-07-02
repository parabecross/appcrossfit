import { getTranslations } from "next-intl/server";

import { requireRole } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { MembershipBanner } from "@/components/membresias/membership-banner";
import { SocioPageHeader } from "@/components/socio/socio-page-header";
import { formatDate } from "@/lib/utils";
import { CreditCard, CalendarDays } from "lucide-react";
import type { Membresia, Plan } from "@/types/database";

export const dynamic = "force-dynamic";

type MembresiaWithPlan = Membresia & { plan: Plan | null };

function daysUntil(dateStr: string) {
  const end = new Date(`${dateStr}T23:59:59`);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function MiMembresiaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("membership");
  const ts = await getTranslations("socio");
  const tm = await getTranslations("membership.status");
  const profile = await requireRole(locale, ["socio"]);
  const supabase = await createClient();

  const { data: membresias } = await supabase
    .from("membresias")
    .select("*, plan:planes(*)")
    .eq("usuario_id", profile.id)
    .order("fecha_fin", { ascending: false });

  const current = (membresias as MembresiaWithPlan[] | null)?.[0];
  const daysLeft =
    current?.estado === "vigente" ? daysUntil(current.fecha_fin) : null;

  return (
    <div className="space-y-5">
      <SocioPageHeader
        title={t("title")}
        subtitle={ts("membershipSubtitle")}
      />

      {profile.estado_cuenta === "pendiente_pago" && (
        <MembershipBanner type="pending" locale={locale} />
      )}
      {current?.estado === "vencida" && (
        <MembershipBanner
          type="expired"
          expiryDate={current.fecha_fin}
          locale={locale}
        />
      )}

      <div className="rounded-2xl brand-gradient p-5 text-white shadow-lg glow-primary">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">
              {t("currentPlan")}
            </p>
            {current ? (
              <>
                <p className="text-2xl font-black mt-1 leading-tight">
                  {current.plan?.nombre}
                </p>
                <p className="text-sm opacity-90 mt-2 flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {t("expires")}: {formatDate(current.fecha_fin, locale)}
                </p>
              </>
            ) : (
              <p className="text-lg font-semibold mt-1 opacity-90">
                {t("noMembership")}
              </p>
            )}
          </div>
          {current && (
            <Badge
              variant={current.estado === "vigente" ? "success" : "destructive"}
              className="bg-white/20 text-white border-0 shrink-0"
            >
              {tm(current.estado)}
            </Badge>
          )}
        </div>
        {daysLeft !== null && daysLeft >= 0 && (
          <p className="mt-4 text-sm font-medium bg-white/10 rounded-xl px-3 py-2 inline-block">
            {t("daysRemaining", { days: daysLeft })}
          </p>
        )}
      </div>

      {(membresias as MembresiaWithPlan[] ?? []).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t("history")}
          </h2>
          {(membresias as MembresiaWithPlan[]).map((m) => (
            <div
              key={m.id}
              className="rounded-2xl border border-white/10 bg-card/50 p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <CreditCard className="h-4 w-4 text-primary shrink-0" />
                  <p className="font-semibold truncate">{m.plan?.nombre}</p>
                </div>
                <Badge
                  variant={
                    m.estado === "vigente"
                      ? "success"
                      : m.estado === "vencida"
                        ? "destructive"
                        : "secondary"
                  }
                  className="shrink-0"
                >
                  {tm(m.estado)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                {formatDate(m.fecha_inicio, locale)} –{" "}
                {formatDate(m.fecha_fin, locale)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
