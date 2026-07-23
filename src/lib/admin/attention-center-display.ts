/**
 * Display helpers for Centro de Atención — pure UI rules over existing inbox rows.
 * Does not change retention score or SQL.
 */

import { daysUntilDateOnly } from "@/lib/dates/date-only";
import type { SocioDisplayStatus } from "@/lib/membresias/helpers";

export const INACTIVE_DAYS_THRESHOLD = 10;

export type AttentionCenterStatus =
  | "vencido"
  | "por_vencer"
  | "sin_asistir"
  | "activo";

export type AttentionCenterStatusInput = {
  membershipStatus: SocioDisplayStatus | string | null;
  daysSinceAttendance: number | null;
  reasons?: string[];
};

/** Visual priority: Vencido > Por vencer > Sin asistir > Activo */
export function resolveAttentionCenterStatus(
  row: AttentionCenterStatusInput
): AttentionCenterStatus {
  const ms = row.membershipStatus;
  if (
    ms === "vencida" ||
    ms === "sin_membresia" ||
    row.reasons?.includes("membership_expired")
  ) {
    return "vencido";
  }
  if (
    ms === "por_vencer" ||
    ms === "pendiente_pago" ||
    row.reasons?.includes("membership_expiring") ||
    row.reasons?.includes("pending_payment")
  ) {
    return "por_vencer";
  }
  if (isInactiveAttendance(row)) {
    return "sin_asistir";
  }
  return "activo";
}

export function isInactiveAttendance(row: AttentionCenterStatusInput): boolean {
  if (row.daysSinceAttendance != null && row.daysSinceAttendance >= INACTIVE_DAYS_THRESHOLD) {
    return true;
  }
  return (
    row.reasons?.some((r) =>
      ["inactive_10", "inactive_15", "never_attended"].includes(r)
    ) ?? false
  );
}

export function isMembershipExpiredRow(row: AttentionCenterStatusInput): boolean {
  return (
    row.membershipStatus === "vencida" ||
    row.membershipStatus === "sin_membresia" ||
    (row.reasons?.includes("membership_expired") ?? false)
  );
}

export function isMembershipExpiringRow(row: AttentionCenterStatusInput): boolean {
  return (
    row.membershipStatus === "por_vencer" ||
    (row.reasons?.includes("membership_expiring") ?? false)
  );
}

export function isActiveMembershipRow(row: AttentionCenterStatusInput): boolean {
  return resolveAttentionCenterStatus(row) === "activo";
}

export function formatLastAttendanceLabel(
  days: number | null,
  labels: {
    today: string;
    daysAgo: (n: number) => string;
    never: string;
  }
): string {
  if (days == null) return labels.never;
  if (days <= 0) return labels.today;
  return labels.daysAgo(days);
}

export function formatMembershipSummary(
  input: {
    membershipStatus: SocioDisplayStatus | string | null;
    fechaFin: string | null;
    today: string;
  },
  labels: {
    active: string;
    expiresIn: (days: number) => string;
    expiredAgo: (days: number) => string;
    none: string;
  }
): string {
  const { membershipStatus, fechaFin, today } = input;
  if (!fechaFin || membershipStatus === "sin_membresia") {
    return labels.none;
  }
  const delta = daysUntilDateOnly(fechaFin, today);
  if (delta < 0 || membershipStatus === "vencida") {
    return labels.expiredAgo(Math.abs(delta));
  }
  if (membershipStatus === "por_vencer") {
    return labels.expiresIn(delta);
  }
  return labels.active;
}

export type AttentionPriorities = {
  inactive: number;
  expiring: number;
  expired: number;
  newWithoutBooking: number;
};

export function isNewWithoutBookingRow(row: {
  reasons: string[];
  hasWeekBooking: boolean;
}): boolean {
  return row.reasons.includes("new_athlete") && !row.hasWeekBooking;
}

export function buildAttentionPriorities<
  T extends {
    membershipStatus: string | null;
    daysSinceAttendance: number | null;
    reasons: string[];
    hasWeekBooking: boolean;
  },
>(rows: T[]): AttentionPriorities {
  let inactive = 0;
  let expiring = 0;
  let expired = 0;
  let newWithoutBooking = 0;

  for (const row of rows) {
    if (isInactiveAttendance(row)) inactive += 1;
    if (isMembershipExpiringRow(row)) expiring += 1;
    if (isMembershipExpiredRow(row)) expired += 1;
    if (isNewWithoutBookingRow(row)) newWithoutBooking += 1;
  }

  return { inactive, expiring, expired, newWithoutBooking };
}

export type AttentionKpiCounts = {
  total: number;
  active: number;
  expiring: number;
  expired: number;
  inactive: number;
};

export function countAttentionKpis<
  T extends AttentionCenterStatusInput & { reasons?: string[] },
>(rows: T[]): AttentionKpiCounts {
  let active = 0;
  let expiring = 0;
  let expired = 0;
  let inactive = 0;

  for (const row of rows) {
    if (isMembershipExpiredRow(row)) expired += 1;
    if (isMembershipExpiringRow(row)) expiring += 1;
    if (isInactiveAttendance(row)) inactive += 1;
    if (resolveAttentionCenterStatus(row) === "activo") active += 1;
  }

  return {
    total: rows.length,
    active,
    expiring,
    expired,
    inactive,
  };
}

export function attentionStatusSortRank(status: AttentionCenterStatus): number {
  switch (status) {
    case "vencido":
      return 0;
    case "por_vencer":
      return 1;
    case "sin_asistir":
      return 2;
    case "activo":
      return 3;
  }
}
