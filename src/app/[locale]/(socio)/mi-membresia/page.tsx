import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MembershipBanner } from "@/components/membresias/membership-banner";
import { formatDate } from "@/lib/utils";
import type { Membresia, Plan } from "@/types/database";

type MembresiaWithPlan = Membresia & { plan: Plan | null };

export default async function MiMembresiaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("membership");
  const tm = await getTranslations("membership.status");
  const profile = await requireRole(locale, ["socio"]);
  const supabase = await createClient();

  const { data: membresias } = await supabase
    .from("membresias")
    .select("*, plan:planes(*)")
    .eq("usuario_id", profile.id)
    .order("fecha_fin", { ascending: false });

  const current = (membresias as MembresiaWithPlan[] | null)?.[0];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-black brand-text">
        {t("title")}
      </h1>

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

      <Card className="glow-primary">
        <CardHeader>
          <CardTitle>{t("currentPlan")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {current ? (
            <>
              <p className="text-2xl font-black">{current.plan?.nombre}</p>
              <p className="text-muted-foreground">
                {t("expires")}: {formatDate(current.fecha_fin, locale)}
              </p>
              <Badge
                variant={
                  current.estado === "vigente" ? "success" : "destructive"
                }
              >
                {tm(current.estado)}
              </Badge>
            </>
          ) : (
            <p className="text-muted-foreground">{t("noMembership")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("history")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(membresias as MembresiaWithPlan[] ?? []).map((m) => (
            <div
              key={m.id}
              className="flex justify-between rounded-lg bg-secondary/30 px-3 py-2 text-sm"
            >
              <span>{m.plan?.nombre}</span>
              <span className="text-muted-foreground">
                {formatDate(m.fecha_inicio, locale)} –{" "}
                {formatDate(m.fecha_fin, locale)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* FUTURO: historial de pagos desde tabla `pagos` cuando se integre pasarela */}
    </div>
  );
}
