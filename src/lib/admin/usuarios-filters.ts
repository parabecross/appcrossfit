/**
 * URL filter contract for Centro de Atención.
 * Legacy query aliases still parse safely into the simplified views.
 */

import {
  attentionStatusSortRank,
  isActiveMembershipRow,
  isInactiveAttendance,
  isMembershipExpiredRow,
  isMembershipExpiringRow,
  isNewWithoutBookingRow,
  resolveAttentionCenterStatus,
} from "./attention-center-display";

export const USUARIOS_VIEW_VALUES = [
  "all",
  "active",
  "membership_expiring",
  "membership_expired",
  "inactive",
  "new_without_booking",
] as const;

export type UsuariosInboxView = (typeof USUARIOS_VIEW_VALUES)[number];

export type UsuariosInboxFilters = {
  view: UsuariosInboxView;
  q: string;
};

const VIEW_SET = new Set<string>(USUARIOS_VIEW_VALUES);

/** Legacy views still accepted in URLs / deep links → mapped to current views. */
const LEGACY_VIEW_MAP: Record<string, UsuariosInboxView> = {
  attention_high: "inactive",
  attention_medium: "inactive",
  payment_pending: "membership_expiring",
  no_reservation: "new_without_booking",
  follow_up_overdue: "inactive",
  follow_up_today: "all",
  never_contacted: "all",
  recently_contacted: "all",
};

function asView(value: string | null | undefined): UsuariosInboxView | null {
  if (!value) return null;
  if (VIEW_SET.has(value)) return value as UsuariosInboxView;
  return LEGACY_VIEW_MAP[value] ?? null;
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
  if (attention === "high" || attention === "medium") {
    return { view: "inactive", q };
  }

  const membership = get("membership");
  if (membership === "expired") return { view: "membership_expired", q };
  if (membership === "expiring") return { view: "membership_expiring", q };

  const payment = get("payment");
  if (payment === "pending") return { view: "membership_expiring", q };

  const attendance = get("attendance");
  if (attendance === "inactive") return { view: "inactive", q };

  const reservation = get("reservation");
  if (reservation === "missing") return { view: "new_without_booking", q };

  const followUp = get("follow_up");
  if (followUp === "overdue") return { view: "inactive", q };
  if (followUp === "today") return { view: "all", q };

  const contact = get("contact");
  if (contact === "never" || contact === "recent") return { view: "all", q };

  const status = get("status");
  if (status === "active") return { view: "active", q };

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
  needsAttention: buildUsuariosInboxHref({ view: "inactive" }),
  attentionHigh: buildUsuariosInboxHref({ view: "inactive" }),
  attentionMedium: buildUsuariosInboxHref({ view: "inactive" }),
  membershipExpired: buildUsuariosInboxHref({ view: "membership_expired" }),
  membershipExpiring: buildUsuariosInboxHref({ view: "membership_expiring" }),
  paymentPending: buildUsuariosInboxHref({ view: "membership_expiring" }),
  inactive: buildUsuariosInboxHref({ view: "inactive" }),
  noReservation: buildUsuariosInboxHref({ view: "new_without_booking" }),
  followUpOverdue: buildUsuariosInboxHref({ view: "inactive" }),
  followUpToday: buildUsuariosInboxHref({ view: "all" }),
  neverContacted: buildUsuariosInboxHref({ view: "all" }),
  recentlyContacted: buildUsuariosInboxHref({ view: "all" }),
  active: buildUsuariosInboxHref({ view: "active" }),
  newWithoutBooking: buildUsuariosInboxHref({ view: "new_without_booking" }),
  assignMembership: "/admin/usuarios",
  newAthlete: "/admin/usuarios",
} as const;

export type AthleteInboxMatchInput = {
  id: string;
  nombre_completo: string;
  telefono: string | null;
  email?: string | null;
  level: "high" | "medium" | "low" | null;
  score: number;
  daysSinceAttendance: number | null;
  membershipStatus: string | null;
  reasons: string[];
  hasWeekBooking: boolean;
};

export function athleteMatchesInboxView(
  row: AthleteInboxMatchInput,
  view: UsuariosInboxView
): boolean {
  switch (view) {
    case "all":
      return true;
    case "active":
      return isActiveMembershipRow(row);
    case "membership_expired":
      return isMembershipExpiredRow(row);
    case "membership_expiring":
      return isMembershipExpiringRow(row);
    case "inactive":
      return isInactiveAttendance(row);
    case "new_without_booking":
      return isNewWithoutBookingRow(row);
    default:
      return true;
  }
}

function matchesSearch(row: AthleteInboxMatchInput, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    row.nombre_completo.toLowerCase().includes(needle) ||
    (row.telefono?.toLowerCase().includes(needle) ?? false) ||
    (row.telefono?.includes(q) ?? false) ||
    (row.email?.toLowerCase().includes(needle) ?? false)
  );
}

export function filterAthleteInboxRows<T extends AthleteInboxMatchInput>(
  rows: T[],
  filters: UsuariosInboxFilters
): T[] {
  const matched = rows.filter(
    (row) =>
      athleteMatchesInboxView(row, filters.view) && matchesSearch(row, filters.q)
  );

  if (filters.view === "all" && !filters.q.trim()) {
    return matched;
  }

  return [...matched].sort((a, b) => {
    const sa = resolveAttentionCenterStatus(a);
    const sb = resolveAttentionCenterStatus(b);
    const byStatus = attentionStatusSortRank(sa) - attentionStatusSortRank(sb);
    if (byStatus !== 0) return byStatus;

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
