import type { AlertaMembresia, AccountStatus } from "@/types/database";
import type { SocioDisplayStatus } from "@/lib/membresias/helpers";
import {
  computeAthleteRetentionRisk,
  sortAttentionCases,
  type RetentionAttentionLevel,
} from "@/lib/retention/athlete-risk";
import type { WhatsAppMessageType } from "@/lib/whatsapp";

export type AttentionCaseKind =
  | "membership_expired"
  | "membership_expiring"
  | "pending_payment"
  | "inactive"
  | "no_week_booking";

export type AttentionCase = {
  profileId: string;
  nombre: string;
  telefono: string | null;
  fotoUrl: string | null;
  level: RetentionAttentionLevel;
  score: number;
  reasons: string[];
  daysSinceAttendance: number | null;
  membershipStatus: SocioDisplayStatus | null;
  kind: AttentionCaseKind;
  whatsappType: WhatsAppMessageType;
  fechaFin: string | null;
};

export type AttentionAthleteInput = {
  id: string;
  nombre_completo: string;
  telefono: string | null;
  foto_url?: string | null;
  estado_cuenta: AccountStatus;
  created_at?: string | null;
};

const NEW_ATHLETE_DAYS = 14;

function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000
  );
}

function isNewAthlete(createdAt: string | null | undefined, today: string) {
  if (!createdAt) return false;
  const createdDate = createdAt.slice(0, 10);
  return daysBetween(createdDate, today) < NEW_ATHLETE_DAYS;
}

function membershipStatusFromAlert(
  tipo: AlertaMembresia["tipo_alerta"]
): SocioDisplayStatus {
  if (tipo === "vencida") return "vencida";
  if (tipo === "por_vencer") return "por_vencer";
  return "activo";
}

/**
 * Builds a capped, sorted attention inbox from signals already loaded for the dashboard.
 * Does not query Supabase — callers pass snapshots from existing loaders.
 */
export function buildAttentionCases(input: {
  today: string;
  membershipExpired: AlertaMembresia[];
  membershipExpiring: AlertaMembresia[];
  pendingPaymentAthletes: AttentionAthleteInput[];
  inactiveAthletes: Array<{
    profileId: string;
    nombre: string;
    daysSinceAttendance: number;
    telefono?: string | null;
    fotoUrl?: string | null;
  }>;
  athletesWithoutWeekBooking: Array<{
    id: string;
    nombre: string;
    telefono?: string | null;
    fotoUrl?: string | null;
    created_at?: string | null;
  }>;
  limit?: number;
}): AttentionCase[] {
  const byId = new Map<string, AttentionCase>();

  const upsert = (next: AttentionCase) => {
    const prev = byId.get(next.profileId);
    if (!prev) {
      byId.set(next.profileId, next);
      return;
    }
    const mergedReasons = Array.from(
      new Set([...prev.reasons, ...next.reasons])
    );
    const better =
      next.score > prev.score ||
      (next.score === prev.score &&
        (next.daysSinceAttendance ?? -1) >
          (prev.daysSinceAttendance ?? -1));
    byId.set(next.profileId, {
      ...(better ? next : prev),
      reasons: mergedReasons,
      score: Math.max(prev.score, next.score),
      level:
        Math.max(
          { high: 2, medium: 1, low: 0 }[prev.level],
          { high: 2, medium: 1, low: 0 }[next.level]
        ) === 2
          ? "high"
          : Math.max(
                { high: 2, medium: 1, low: 0 }[prev.level],
                { high: 2, medium: 1, low: 0 }[next.level]
              ) === 1
            ? "medium"
            : "low",
      daysSinceAttendance:
        (next.daysSinceAttendance ?? -1) > (prev.daysSinceAttendance ?? -1)
          ? next.daysSinceAttendance
          : prev.daysSinceAttendance,
      telefono: next.telefono ?? prev.telefono,
      fotoUrl: next.fotoUrl ?? prev.fotoUrl,
      fechaFin: next.fechaFin ?? prev.fechaFin,
      whatsappType:
        next.whatsappType === "vencida" || prev.whatsappType === "vencida"
          ? "vencida"
          : next.whatsappType === "por_vencer" ||
              prev.whatsappType === "por_vencer"
            ? "por_vencer"
            : "inactive",
      kind:
        next.kind === "membership_expired" ||
        prev.kind === "membership_expired"
          ? "membership_expired"
          : next.kind === "pending_payment" || prev.kind === "pending_payment"
            ? "pending_payment"
            : next.kind === "membership_expiring" ||
                prev.kind === "membership_expiring"
              ? "membership_expiring"
              : next.kind === "inactive" || prev.kind === "inactive"
                ? "inactive"
                : "no_week_booking",
    });
  };

  for (const a of input.membershipExpired) {
    const risk = computeAthleteRetentionRisk({
      daysSinceLastAttendance: null,
      noWeekBooking: false,
      membershipExpired: true,
      membershipExpiringSoon: false,
      pendingPayment: false,
      accountInactive: false,
      isNewAthlete: false,
    });
    upsert({
      profileId: a.profile_id,
      nombre: a.nombre_completo,
      telefono: a.telefono,
      fotoUrl: null,
      level: risk.level,
      score: risk.score,
      reasons: risk.reasons,
      daysSinceAttendance: null,
      membershipStatus: membershipStatusFromAlert(a.tipo_alerta),
      kind: "membership_expired",
      whatsappType: "vencida",
      fechaFin: a.fecha_fin,
    });
  }

  for (const a of input.membershipExpiring) {
    const risk = computeAthleteRetentionRisk({
      daysSinceLastAttendance: null,
      noWeekBooking: false,
      membershipExpired: false,
      membershipExpiringSoon: true,
      pendingPayment: false,
      accountInactive: false,
      isNewAthlete: false,
    });
    upsert({
      profileId: a.profile_id,
      nombre: a.nombre_completo,
      telefono: a.telefono,
      fotoUrl: null,
      level: risk.level,
      score: risk.score,
      reasons: risk.reasons,
      daysSinceAttendance: null,
      membershipStatus: membershipStatusFromAlert(a.tipo_alerta),
      kind: "membership_expiring",
      whatsappType: "por_vencer",
      fechaFin: a.fecha_fin,
    });
  }

  for (const a of input.pendingPaymentAthletes) {
    const risk = computeAthleteRetentionRisk({
      daysSinceLastAttendance: null,
      noWeekBooking: false,
      membershipExpired: false,
      membershipExpiringSoon: false,
      pendingPayment: true,
      accountInactive: a.estado_cuenta === "inactivo",
      isNewAthlete: isNewAthlete(a.created_at, input.today),
    });
    upsert({
      profileId: a.id,
      nombre: a.nombre_completo,
      telefono: a.telefono,
      fotoUrl: a.foto_url ?? null,
      level: risk.level,
      score: risk.score,
      reasons: risk.reasons,
      daysSinceAttendance: null,
      membershipStatus: "pendiente_pago",
      kind: "pending_payment",
      whatsappType: "pending_payment",
      fechaFin: null,
    });
  }

  for (const a of input.inactiveAthletes) {
    const risk = computeAthleteRetentionRisk({
      daysSinceLastAttendance: a.daysSinceAttendance,
      noWeekBooking: false,
      membershipExpired: false,
      membershipExpiringSoon: false,
      pendingPayment: false,
      accountInactive: false,
      isNewAthlete: false,
    });
    upsert({
      profileId: a.profileId,
      nombre: a.nombre,
      telefono: a.telefono ?? null,
      fotoUrl: a.fotoUrl ?? null,
      level: risk.level,
      score: risk.score,
      reasons: risk.reasons,
      daysSinceAttendance: a.daysSinceAttendance,
      membershipStatus: null,
      kind: "inactive",
      whatsappType: "inactive",
      fechaFin: null,
    });
  }

  for (const a of input.athletesWithoutWeekBooking) {
    const risk = computeAthleteRetentionRisk({
      daysSinceLastAttendance: null,
      noWeekBooking: true,
      membershipExpired: false,
      membershipExpiringSoon: false,
      pendingPayment: false,
      accountInactive: false,
      isNewAthlete: isNewAthlete(a.created_at, input.today),
    });
    if (risk.level === "low" && risk.score < 15) continue;
    upsert({
      profileId: a.id,
      nombre: a.nombre,
      telefono: a.telefono ?? null,
      fotoUrl: a.fotoUrl ?? null,
      level: risk.level,
      score: risk.score,
      reasons: risk.reasons,
      daysSinceAttendance: null,
      membershipStatus: null,
      kind: "no_week_booking",
      whatsappType: "no_reservation",
      fechaFin: null,
    });
  }

  return sortAttentionCases(Array.from(byId.values()), input.limit ?? 8);
}
