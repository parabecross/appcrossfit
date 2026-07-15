/**
 * URL filter contract for the admin athletes operational inbox.
 * Unknown values are ignored safely.
 *
 * Attention sort (non-all views), after matching:
 * 1. Attention level (high → medium → low)
 * 2. Follow-up overdue
 * 3. Never contacted
 * 4. Follow-up today
 * 5. Score descending
 * 6. Days without attendance descending
 * 7. Name
 *
 * Risk score formula is unchanged — only list order is adjusted.
 */

import type { SeguimientoFollowUpStatus } from "@/types/database";

export const USUARIOS_VIEW_VALUES = [
  "all",
  "attention_high",
  "attention_medium",
  "membership_expired",
  "membership_expiring",
  "payment_pending",
  "inactive",
  "no_reservation",
  "follow_up_overdue",
  "follow_up_today",
  "never_contacted",
  "recently_contacted",
] as const;

export type UsuariosInboxView = (typeof USUARIOS_VIEW_VALUES)[number];

export type UsuariosInboxFilters = {
  view: UsuariosInboxView;
  q: string;
};

const VIEW_SET = new Set<string>(USUARIOS_VIEW_VALUES);

function asView(value: string | null | undefined): UsuariosInboxView | null {
  if (!value) return null;
  return VIEW_SET.has(value) ? (value as UsuariosInboxView) : null;
}

export function parseUsuariosInboxFilters(
  raw: Record<string, string | string[] | undefined> | URLSearchParams
): UsuariosInboxFilters {
  const get = (key: string): string | undefined => {
    if (raw instanceof URLSearchParams) {
      return raw.get(key) ?? undefined;
    }
    const v = raw[key];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  const q = (get("q") ?? "").trim();

  const explicitView = asView(get("view"));
  if (explicitView) {
    return { view: explicitView, q };
  }

  const attention = get("attention");
  if (attention === "high") return { view: "attention_high", q };
  if (attention === "medium") return { view: "attention_medium", q };

  const membership = get("membership");
  if (membership === "expired") return { view: "membership_expired", q };
  if (membership === "expiring") return { view: "membership_expiring", q };

  const payment = get("payment");
  if (payment === "pending") return { view: "payment_pending", q };

  const attendance = get("attendance");
  if (attendance === "inactive") return { view: "inactive", q };

  const reservation = get("reservation");
  if (reservation === "missing") return { view: "no_reservation", q };

  const followUp = get("follow_up");
  if (followUp === "overdue") return { view: "follow_up_overdue", q };
  if (followUp === "today") return { view: "follow_up_today", q };

  const contact = get("contact");
  if (contact === "never") return { view: "never_contacted", q };
  if (contact === "recent") return { view: "recently_contacted", q };

  return { view: "all", q };
}

export function buildUsuariosInboxHref(filters: Partial<UsuariosInboxFilters>): string {
  const params = new URLSearchParams();
  const view = filters.view && filters.view !== "all" ? filters.view : null;
  const q = filters.q?.trim() || null;
  if (view) params.set("view", view);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/admin/usuarios?${qs}` : "/admin/usuarios";
}

export const USUARIOS_DEEP_LINKS = {
  needsAttention: buildUsuariosInboxHref({ view: "attention_high" }),
  attentionHigh: buildUsuariosInboxHref({ view: "attention_high" }),
  attentionMedium: buildUsuariosInboxHref({ view: "attention_medium" }),
  membershipExpired: buildUsuariosInboxHref({ view: "membership_expired" }),
  membershipExpiring: buildUsuariosInboxHref({ view: "membership_expiring" }),
  paymentPending: buildUsuariosInboxHref({ view: "payment_pending" }),
  inactive: buildUsuariosInboxHref({ view: "inactive" }),
  noReservation: buildUsuariosInboxHref({ view: "no_reservation" }),
  followUpOverdue: buildUsuariosInboxHref({ view: "follow_up_overdue" }),
  followUpToday: buildUsuariosInboxHref({ view: "follow_up_today" }),
  neverContacted: buildUsuariosInboxHref({ view: "never_contacted" }),
  recentlyContacted: buildUsuariosInboxHref({ view: "recently_contacted" }),
  assignMembership: "/admin/usuarios",
  newAthlete: "/admin/usuarios",
} as const;

export type AthleteInboxMatchInput = {
  id: string;
  nombre_completo: string;
  telefono: string | null;
  level: "high" | "medium" | "low" | null;
  score: number;
  daysSinceAttendance: number | null;
  membershipStatus: string | null;
  reasons: string[];
  hasWeekBooking: boolean;
  followUpStatus?: SeguimientoFollowUpStatus | null;
  neverContacted?: boolean;
  recentlyContacted?: boolean;
};

export function athleteMatchesInboxView(
  row: AthleteInboxMatchInput,
  view: UsuariosInboxView
): boolean {
  switch (view) {
    case "all":
      return true;
    case "attention_high":
      return row.level === "high";
    case "attention_medium":
      return row.level === "medium";
    case "membership_expired":
      return (
        row.membershipStatus === "vencida" ||
        row.membershipStatus === "sin_membresia" ||
        row.reasons.includes("membership_expired")
      );
    case "membership_expiring":
      return (
        row.membershipStatus === "por_vencer" ||
        row.reasons.includes("membership_expiring")
      );
    case "payment_pending":
      return (
        row.membershipStatus === "pendiente_pago" ||
        row.reasons.includes("pending_payment")
      );
    case "inactive":
      return (
        row.reasons.some((r) =>
          ["inactive_7", "inactive_10", "inactive_15"].includes(r)
        ) || (row.daysSinceAttendance != null && row.daysSinceAttendance >= 7)
      );
    case "no_reservation":
      return row.reasons.includes("no_week_booking");
    case "follow_up_overdue":
      return row.followUpStatus === "overdue";
    case "follow_up_today":
      return row.followUpStatus === "today";
    case "never_contacted":
      return row.neverContacted === true;
    case "recently_contacted":
      return row.recentlyContacted === true;
    default:
      return true;
  }
}

function followUpSortRank(row: AthleteInboxMatchInput): number {
  if (row.followUpStatus === "overdue") return 0;
  if (row.neverContacted) return 1;
  if (row.followUpStatus === "today") return 2;
  return 3;
}

export function filterAthleteInboxRows<T extends AthleteInboxMatchInput>(
  rows: T[],
  filters: UsuariosInboxFilters
): T[] {
  const q = filters.q.toLowerCase();
  const matched = rows.filter((row) => {
    if (!athleteMatchesInboxView(row, filters.view)) return false;
    if (!q) return true;
    return (
      row.nombre_completo.toLowerCase().includes(q) ||
      (row.telefono?.includes(filters.q) ?? false)
    );
  });

  if (filters.view === "all" && !q) {
    return matched;
  }

  if (filters.view === "all") {
    return matched;
  }

  return [...matched].sort((a, b) => {
    const levelRank = { high: 0, medium: 1, low: 2, null: 3 } as const;
    const la = a.level ?? "null";
    const lb = b.level ?? "null";
    const byLevel = levelRank[la] - levelRank[lb];
    if (byLevel !== 0) return byLevel;

    const byFollow = followUpSortRank(a) - followUpSortRank(b);
    if (byFollow !== 0) return byFollow;

    if (b.score !== a.score) return b.score - a.score;
    const daysA = a.daysSinceAttendance ?? -1;
    const daysB = b.daysSinceAttendance ?? -1;
    if (daysB !== daysA) return daysB - daysA;
    return a.nombre_completo.localeCompare(b.nombre_completo, "es");
  });
}

export function countInboxViews<T extends AthleteInboxMatchInput>(
  rows: T[]
): Record<UsuariosInboxView, number> {
  const counts = Object.fromEntries(
    USUARIOS_VIEW_VALUES.map((v) => [v, 0])
  ) as Record<UsuariosInboxView, number>;
  counts.all = rows.length;
  for (const view of USUARIOS_VIEW_VALUES) {
    if (view === "all") continue;
    counts[view] = rows.filter((r) => athleteMatchesInboxView(r, view)).length;
  }
  return counts;
}

export function encodeUsuariosReturnParam(filters: UsuariosInboxFilters): string {
  const href = buildUsuariosInboxHref(filters);
  return href.replace("/admin/usuarios", "") || "";
}

export function decodeUsuariosReturnParam(
  ret: string | null | undefined
): string {
  if (!ret) return "/admin/usuarios";
  if (ret.startsWith("?")) return `/admin/usuarios${ret}`;
  if (ret.startsWith("/admin/usuarios")) return ret;
  return `/admin/usuarios${ret.startsWith("?") ? ret : `?${ret}`}`;
}
