/**
 * Deterministic retention attention score (V1).
 *
 * Not a prediction of churn — a transparent operational priority signal.
 * Score is clamped to 0–100. New athletes (<14 days) are dampened to
 * avoid false positives from missing attendance history.
 */

export type RetentionAttentionLevel = "high" | "medium" | "low";

export type AthleteRetentionRisk = {
  level: RetentionAttentionLevel;
  score: number;
  reasons: string[];
};

export type AthleteRetentionSignals = {
  /** Days since last `asistio` reservation. Null = never attended. */
  daysSinceLastAttendance: number | null;
  /** Active athlete with no confirmada/asistio booking in the current week. */
  noWeekBooking: boolean;
  membershipExpired: boolean;
  membershipExpiringSoon: boolean;
  pendingPayment: boolean;
  accountInactive: boolean;
  /** Profile created within the last N days (default threshold: 14). */
  isNewAthlete: boolean;
  /**
   * Optional frequency drop: recent period attendance vs prior period.
   * Only applied when priorCount >= 2 and recent < prior * 0.5.
   */
  recentAttendanceCount?: number;
  priorAttendanceCount?: number;
};

export const RETENTION_REASON = {
  membershipExpired: "membership_expired",
  membershipExpiring: "membership_expiring",
  pendingPayment: "pending_payment",
  accountInactive: "account_inactive",
  inactive7: "inactive_7",
  inactive10: "inactive_10",
  inactive15: "inactive_15",
  neverAttended: "never_attended",
  noWeekBooking: "no_week_booking",
  attendanceDrop: "attendance_drop",
  newAthlete: "new_athlete",
} as const;

export type RetentionReasonKey =
  (typeof RETENTION_REASON)[keyof typeof RETENTION_REASON];

const NEW_ATHLETE_SCORE_CAP = 40;

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function levelFromScore(score: number): RetentionAttentionLevel {
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

/**
 * Pure, side-effect-free attention score from existing operational signals.
 */
export function computeAthleteRetentionRisk(
  signals: AthleteRetentionSignals
): AthleteRetentionRisk {
  let score = 0;
  const reasons: string[] = [];

  if (signals.membershipExpired) {
    score += 35;
    reasons.push(RETENTION_REASON.membershipExpired);
  } else if (signals.membershipExpiringSoon) {
    score += 20;
    reasons.push(RETENTION_REASON.membershipExpiring);
  }

  if (signals.pendingPayment) {
    score += 25;
    reasons.push(RETENTION_REASON.pendingPayment);
  }

  if (signals.accountInactive) {
    score += 20;
    reasons.push(RETENTION_REASON.accountInactive);
  }

  const days = signals.daysSinceLastAttendance;
  if (days === null) {
    if (!signals.isNewAthlete) {
      score += 10;
      reasons.push(RETENTION_REASON.neverAttended);
    }
  } else if (days >= 15) {
    score += 35;
    reasons.push(RETENTION_REASON.inactive15);
  } else if (days >= 10) {
    score += 25;
    reasons.push(RETENTION_REASON.inactive10);
  } else if (days >= 7) {
    score += 15;
    reasons.push(RETENTION_REASON.inactive7);
  }

  if (signals.noWeekBooking && !signals.isNewAthlete) {
    score += 15;
    reasons.push(RETENTION_REASON.noWeekBooking);
  }

  const prior = signals.priorAttendanceCount ?? 0;
  const recent = signals.recentAttendanceCount ?? 0;
  if (prior >= 2 && recent < prior * 0.5) {
    score += 15;
    reasons.push(RETENTION_REASON.attendanceDrop);
  }

  if (signals.isNewAthlete) {
    reasons.push(RETENTION_REASON.newAthlete);
    score = Math.min(score, NEW_ATHLETE_SCORE_CAP);
  }

  const clamped = clampScore(score);
  return {
    score: clamped,
    level: levelFromScore(clamped),
    reasons,
  };
}

export function compareAttentionCases<
  T extends {
    level: RetentionAttentionLevel;
    score: number;
    daysSinceAttendance: number | null;
    nombre: string;
  },
>(a: T, b: T): number {
  const levelRank = { high: 0, medium: 1, low: 2 } as const;
  const byLevel = levelRank[a.level] - levelRank[b.level];
  if (byLevel !== 0) return byLevel;
  if (b.score !== a.score) return b.score - a.score;
  const daysA = a.daysSinceAttendance ?? -1;
  const daysB = b.daysSinceAttendance ?? -1;
  if (daysB !== daysA) return daysB - daysA;
  return a.nombre.localeCompare(b.nombre, "es");
}

export function sortAttentionCases<
  T extends {
    level: RetentionAttentionLevel;
    score: number;
    daysSinceAttendance: number | null;
    nombre: string;
  },
>(cases: T[], limit = 8): T[] {
  return [...cases].sort(compareAttentionCases).slice(0, limit);
}
