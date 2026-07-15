import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAthleteClassHistory } from "@/lib/queries/athlete-history";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { getBoxConfig } from "@/lib/box/config";
import { getAtletaSkillsAndMarcasSummaryMap } from "@/lib/queries/atleta-summary";
import { getWeekRangeInTimezone } from "@/lib/admin/dashboard-helpers";
import { getSocioDisplayStatus } from "@/lib/membresias/helpers";
import { computeAthleteAttentionFromHistory } from "@/lib/queries/admin-usuarios-inbox";
import { decodeUsuariosReturnParam } from "@/lib/admin/usuarios-filters";
import { todayInTimezone } from "@/lib/dates/date-only";
import {
  getAthleteFollowUpSummary,
  listAthleteInteractions,
} from "@/lib/queries/seguimientos";
import { UserDetailClient } from "@/components/admin/user-detail";
import { AthleteAttentionPanel } from "@/components/admin/athlete-attention-panel";
import { AthleteSeguimientoSection } from "@/components/admin/athlete-seguimiento-section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate } from "@/lib/utils";
import { buildAthleteFollowUpSummary } from "@/lib/seguimientos/helpers";

export const dynamic = "force-dynamic";

function initials(nombre: string) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const retRaw = Array.isArray(sp.ret) ? sp.ret[0] : sp.ret;
  const backHref = decodeUsuariosReturnParam(retRaw);

  const adminProfile = await requireAdmin(locale);
  const supabase = await createClient();
  const boxConfig = await getBoxConfig(adminProfile.box_id);
  const today = todayInTimezone(boxConfig.timezone);
  const weekRange = getWeekRangeInTimezone(boxConfig.timezone);
  const td = await getTranslations("adminDashboard.attention");
  const tinbox = await getTranslations("admin.athletesInbox");
  const ta = await getTranslations("admin");

  const { data: user } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("box_id", adminProfile.box_id)
    .single();

  if (!user) notFound();

  let email: string | null = null;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient();
    const { data: authData } = await admin.auth.admin.getUserById(user.user_id);
    email = authData.user?.email ?? null;
  }

  const entitlements = await getBoxEntitlements(adminProfile.box_id!);

  const [{ data: membresias }, { data: planes }, classHistory, progressMaps] =
    await Promise.all([
      supabase
        .from("membresias")
        .select("*, plan:planes(*)")
        .eq("usuario_id", id)
        .order("fecha_fin", { ascending: false }),
      supabase
        .from("planes")
        .select("*")
        .eq("activo", true)
        .eq("box_id", adminProfile.box_id!),
      getAthleteClassHistory(id, adminProfile.box_id!),
      getAtletaSkillsAndMarcasSummaryMap([id]),
    ]);

  const current = (membresias ?? [])[0] ?? null;
  const membershipStatus = getSocioDisplayStatus(
    user,
    current,
    boxConfig.timezone
  );

  const lastAttendance =
    classHistory.find((r) => r.estado === "asistio")?.clase.fecha ?? null;
  const hasWeekBooking = classHistory.some(
    (r) =>
      ["confirmada", "asistio"].includes(r.estado) &&
      r.clase.fecha >= weekRange.from &&
      r.clase.fecha <= weekRange.to
  );

  const attention = computeAthleteAttentionFromHistory({
    today,
    profile: user,
    membershipStatus,
    lastAttendanceDate: lastAttendance,
    hasWeekBooking,
    weekFrom: weekRange.from,
    weekTo: weekRange.to,
  });

  const skills = progressMaps.skillsMap.get(id) ?? null;
  const marcas = progressMaps.marcasMap.get(id) ?? null;

  const recentPrs = (marcas?.items ?? []).slice(0, 5);
  const recentSkills = [
    ...(skills?.dominado ?? []),
    ...(skills?.logrado ?? []),
  ].slice(0, 5);

  const [interactionsResult, summaryResult] = await Promise.all([
    listAthleteInteractions(id, { limit: 15 }),
    getAthleteFollowUpSummary(id),
  ]);
  const tableMissing =
    (!interactionsResult.ok && interactionsResult.error === "table_missing") ||
    (!summaryResult.ok && summaryResult.error === "table_missing");
  const seguimientoItems = interactionsResult.ok
    ? interactionsResult.items
    : [];
  const seguimientoSummary = summaryResult.ok
    ? summaryResult.summary
    : buildAthleteFollowUpSummary([]);
  const hasMoreInteractions = interactionsResult.ok
    ? interactionsResult.hasMore
    : false;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Avatar className="h-16 w-16">
          {user.foto_url ? <AvatarImage src={user.foto_url} alt="" /> : null}
          <AvatarFallback className="text-lg">
            {initials(user.nombre_completo)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-1">
          <h1 className="text-3xl font-black truncate">{user.nombre_completo}</h1>
          <p className="text-sm text-muted-foreground">
            {ta("joinedOn", {
              date: formatDate(user.created_at.slice(0, 10), locale),
            })}
          </p>
        </div>
      </div>

      <AthleteAttentionPanel
        level={attention.level}
        score={attention.score}
        reasons={attention.reasons}
        reasonLabels={Object.fromEntries(
          attention.reasons.map((key) => [
            key,
            td(`reasons.${key}` as never),
          ])
        )}
        labels={{
          title: tinbox("expediente.attentionTitle"),
          signals: tinbox("expediente.signals"),
          scoreHint: tinbox("expediente.scoreHint"),
          levelHigh: td("levelHigh"),
          levelMedium: td("levelMedium"),
          levelLow: td("levelLow"),
          backToInbox: tinbox("expediente.backToInbox"),
        }}
        phone={user.telefono}
        nombre={user.nombre_completo}
        fechaFin={current?.fecha_fin ?? null}
        locale={locale}
        boxName={boxConfig.name}
        whatsappType={attention.whatsappType}
        backHref={backHref}
        athleteId={user.id}
      />

      <AthleteSeguimientoSection
        athleteId={user.id}
        athleteName={user.nombre_completo}
        items={seguimientoItems}
        summary={seguimientoSummary}
        locale={locale}
        hasMore={hasMoreInteractions}
        tableMissing={tableMissing}
      />

      <UserDetailClient
        user={user}
        email={email}
        membresias={membresias ?? []}
        classHistory={classHistory}
        planes={planes ?? []}
        locale={locale}
        entitlements={entitlements}
        progressSummary={{
          recentPrs: recentPrs.map((p) => ({
            ejercicio: p.ejercicio,
            valor: Number(p.valor),
            unidad: p.unidad,
            fecha: p.fecha,
          })),
          recentSkills: recentSkills.map((s) => ({
            skill: s.skill,
            estado: s.estado,
          })),
          misAtletasHref: "/admin/mis-atletas",
        }}
        attendanceMeta={{
          lastAttendanceDate: lastAttendance,
          daysSinceAttendance: attention.daysSinceAttendance,
          hasWeekBooking,
        }}
      />
    </div>
  );
}
