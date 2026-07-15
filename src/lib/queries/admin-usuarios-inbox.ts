import { createClient } from "@/lib/supabase/server";
import {
  getWeekRangeInTimezone,
  findInactiveAthletes,
  findAthletesWithoutWeekBooking,
} from "@/lib/admin/dashboard-helpers";
import {
  computeAlertasMembresiaFromSocios,
  type MembresiaWithPlan,
} from "@/lib/queries/memberships";
import { getSocioDisplayStatus } from "@/lib/membresias/helpers";
import { partitionMembershipAlerts } from "@/lib/admin/dashboard-helpers";
import {
  computeAthleteRetentionRisk,
  type RetentionAttentionLevel,
} from "@/lib/retention/athlete-risk";
import { todayInTimezone } from "@/lib/dates/date-only";
import type { WhatsAppMessageType } from "@/lib/whatsapp";
import type {
  AccountStatus,
  Profile,
  SeguimientoFollowUpStatus,
} from "@/types/database";
import type { AthleteFollowUpSummary } from "@/lib/seguimientos/helpers";

export type AthleteInboxRow = {
  id: string;
  user_id: string;
  nombre_completo: string;
  telefono: string | null;
  foto_url: string | null;
  estado_cuenta: AccountStatus;
  created_at: string;
  bio: string | null;
  membresia: MembresiaWithPlan | null;
  membershipStatus: ReturnType<typeof getSocioDisplayStatus>;
  level: RetentionAttentionLevel;
  score: number;
  reasons: string[];
  daysSinceAttendance: number | null;
  lastAttendanceDate: string | null;
  hasWeekBooking: boolean;
  nextReservation: { fecha: string; hora: string; nombre: string } | null;
  whatsappType: WhatsAppMessageType;
  fechaFin: string | null;
  followUpStatus: SeguimientoFollowUpStatus;
  followUpAt: string | null;
  lastContactAt: string | null;
  neverContacted: boolean;
  recentlyContacted: boolean;
  resolvedRecently: boolean;
};

function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000
  );
}

function isNewAthlete(createdAt: string, today: string) {
  return daysBetween(createdAt.slice(0, 10), today) < 14;
}

function pickWhatsAppType(
  membershipStatus: ReturnType<typeof getSocioDisplayStatus>,
  reasons: string[]
): WhatsAppMessageType {
  if (
    membershipStatus === "vencida" ||
    membershipStatus === "sin_membresia" ||
    reasons.includes("membership_expired")
  ) {
    return "vencida";
  }
  if (membershipStatus === "pendiente_pago" || reasons.includes("pending_payment")) {
    return "pending_payment";
  }
  if (
    membershipStatus === "por_vencer" ||
    reasons.includes("membership_expiring")
  ) {
    return "por_vencer";
  }
  if (reasons.includes("no_week_booking")) {
    return "no_reservation";
  }
  if (
    reasons.some((r) =>
      ["inactive_7", "inactive_10", "inactive_15", "never_attended"].includes(r)
    )
  ) {
    return "inactive";
  }
  return "general";
}

/**
 * Aggregated inbox snapshot for all box socios — no per-athlete queries.
 */
export async function buildAdminUsuariosInbox(
  socios: Profile[],
  memMap: Map<string, MembresiaWithPlan>,
  timezone: string,
  followUpByAthlete?: Map<string, AthleteFollowUpSummary>
): Promise<AthleteInboxRow[]> {
  const today = todayInTimezone(timezone);
  const weekRange = getWeekRangeInTimezone(timezone);
  const socioIds = socios.map((s) => s.id);

  const lastAttendanceByUser = new Map<string, string>();
  const bookedThisWeek = new Set<string>();
  const nextReservationByUser = new Map<
    string,
    { fecha: string; hora: string; nombre: string }
  >();

  if (socioIds.length > 0) {
    const supabase = await createClient();

    const { data: reservas } = await supabase
      .from("reservas")
      .select(
        "usuario_id, estado, clase:clases(fecha, hora_inicio, nombre, box_id)"
      )
      .in("usuario_id", socioIds)
      .in("estado", ["asistio", "confirmada", "no_asistio"]);

    for (const r of reservas ?? []) {
      const clase = r.clase as {
        fecha?: string;
        hora_inicio?: string;
        nombre?: string;
        box_id?: string;
      } | null;
      if (!clase?.fecha) continue;

      if (r.estado === "asistio") {
        const prev = lastAttendanceByUser.get(r.usuario_id);
        if (!prev || clase.fecha > prev) {
          lastAttendanceByUser.set(r.usuario_id, clase.fecha);
        }
      }

      if (
        ["confirmada", "asistio"].includes(r.estado) &&
        clase.fecha >= weekRange.from &&
        clase.fecha <= weekRange.to
      ) {
        bookedThisWeek.add(r.usuario_id);
      }

      if (r.estado === "confirmada" && clase.fecha >= today) {
        const cur = nextReservationByUser.get(r.usuario_id);
        const candidate = {
          fecha: clase.fecha,
          hora: clase.hora_inicio ?? "",
          nombre: clase.nombre ?? "—",
        };
        if (
          !cur ||
          candidate.fecha < cur.fecha ||
          (candidate.fecha === cur.fecha && candidate.hora < cur.hora)
        ) {
          nextReservationByUser.set(r.usuario_id, candidate);
        }
      }
    }
  }

  const alertas = computeAlertasMembresiaFromSocios(socios, memMap, timezone);
  const { vencidas, porVencer } = partitionMembershipAlerts(alertas);
  const expiredIds = new Set(vencidas.map((a) => a.profile_id));
  const expiringIds = new Set(porVencer.map((a) => a.profile_id));

  const inactiveAlerts = findInactiveAthletes(
    socios.map((s) => ({
      id: s.id,
      nombre_completo: s.nombre_completo,
      telefono: s.telefono,
      foto_url: s.foto_url,
    })),
    lastAttendanceByUser,
    today,
    7
  );
  const inactiveDaysMap = new Map(
    inactiveAlerts.map((a) => [a.profileId, a.daysSinceAttendance])
  );

  const withoutWeek = new Set(
    findAthletesWithoutWeekBooking(
      socios
        .filter((s) => {
          const status = getSocioDisplayStatus(
            s,
            memMap.get(s.id) ?? null,
            timezone
          );
          return status === "activo" || status === "por_vencer";
        })
        .map((s) => s.id),
      bookedThisWeek
    )
  );

  return socios.map((s) => {
    const membresia = memMap.get(s.id) ?? null;
    const membershipStatus = getSocioDisplayStatus(s, membresia, timezone);
    const lastAttendanceDate = lastAttendanceByUser.get(s.id) ?? null;
    const daysSinceAttendance = lastAttendanceDate
      ? daysBetween(lastAttendanceDate, today)
      : null;
    const hasWeekBooking = bookedThisWeek.has(s.id);
    const newAthlete = isNewAthlete(s.created_at, today);

    const risk = computeAthleteRetentionRisk({
      daysSinceLastAttendance: daysSinceAttendance,
      noWeekBooking: withoutWeek.has(s.id),
      membershipExpired:
        expiredIds.has(s.id) ||
        membershipStatus === "vencida" ||
        membershipStatus === "sin_membresia",
      membershipExpiringSoon:
        expiringIds.has(s.id) || membershipStatus === "por_vencer",
      pendingPayment: membershipStatus === "pendiente_pago",
      accountInactive: s.estado_cuenta === "inactivo",
      isNewAthlete: newAthlete,
    });

    const follow = followUpByAthlete?.get(s.id);

    return {
      id: s.id,
      user_id: s.user_id,
      nombre_completo: s.nombre_completo,
      telefono: s.telefono,
      foto_url: s.foto_url,
      estado_cuenta: s.estado_cuenta,
      created_at: s.created_at,
      bio: s.bio,
      membresia,
      membershipStatus,
      level: risk.level,
      score: risk.score,
      reasons: risk.reasons,
      daysSinceAttendance:
        daysSinceAttendance ?? inactiveDaysMap.get(s.id) ?? null,
      lastAttendanceDate,
      hasWeekBooking,
      nextReservation: nextReservationByUser.get(s.id) ?? null,
      whatsappType: pickWhatsAppType(membershipStatus, risk.reasons),
      fechaFin: membresia?.fecha_fin ?? null,
      followUpStatus: follow?.followUpStatus ?? "never_contacted",
      followUpAt: follow?.followUpAt ?? null,
      lastContactAt: follow?.lastContactAt ?? null,
      neverContacted: follow?.neverContacted ?? true,
      recentlyContacted: follow?.recentlyContacted ?? false,
      resolvedRecently: follow?.resolvedRecently ?? false,
    };
  });
}

/**
 * Compute attention for a single athlete from already-loaded history (expediente).
 */
export function computeAthleteAttentionFromHistory(input: {
  today: string;
  profile: Pick<Profile, "estado_cuenta" | "created_at">;
  membershipStatus: ReturnType<typeof getSocioDisplayStatus>;
  lastAttendanceDate: string | null;
  hasWeekBooking: boolean;
  weekFrom: string;
  weekTo: string;
}): {
  level: RetentionAttentionLevel;
  score: number;
  reasons: string[];
  daysSinceAttendance: number | null;
  whatsappType: WhatsAppMessageType;
} {
  const daysSinceAttendance = input.lastAttendanceDate
    ? daysBetween(input.lastAttendanceDate, input.today)
    : null;

  const risk = computeAthleteRetentionRisk({
    daysSinceLastAttendance: daysSinceAttendance,
    noWeekBooking: !input.hasWeekBooking,
    membershipExpired:
      input.membershipStatus === "vencida" ||
      input.membershipStatus === "sin_membresia",
    membershipExpiringSoon: input.membershipStatus === "por_vencer",
    pendingPayment: input.membershipStatus === "pendiente_pago",
    accountInactive: input.profile.estado_cuenta === "inactivo",
    isNewAthlete: isNewAthlete(input.profile.created_at, input.today),
  });

  return {
    ...risk,
    daysSinceAttendance,
    whatsappType: pickWhatsAppType(input.membershipStatus, risk.reasons),
  };
}
