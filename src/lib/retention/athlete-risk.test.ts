import { describe, expect, it } from "vitest";
import {
  computeAthleteRetentionRisk,
  sortAttentionCases,
  RETENTION_REASON,
  type AthleteRetentionSignals,
} from "./athlete-risk";

const base: AthleteRetentionSignals = {
  daysSinceLastAttendance: 2,
  noWeekBooking: false,
  membershipExpired: false,
  membershipExpiringSoon: false,
  pendingPayment: false,
  accountInactive: false,
  isNewAthlete: false,
};

describe("computeAthleteRetentionRisk", () => {
  it("scores an active consistent athlete as low / follow-up", () => {
    const risk = computeAthleteRetentionRisk(base);
    expect(risk.score).toBe(0);
    expect(risk.level).toBe("low");
    expect(risk.reasons).toEqual([]);
  });

  it("flags inactive athletes by days without attendance", () => {
    const mid = computeAthleteRetentionRisk({
      ...base,
      daysSinceLastAttendance: 10,
    });
    expect(mid.score).toBe(25);
    expect(mid.level).toBe("medium");
    expect(mid.reasons).toContain(RETENTION_REASON.inactive10);

    const high = computeAthleteRetentionRisk({
      ...base,
      daysSinceLastAttendance: 20,
    });
    expect(high.score).toBe(35);
    expect(high.level).toBe("medium");
    expect(high.reasons).toContain(RETENTION_REASON.inactive15);
  });

  it("treats expired membership as high priority", () => {
    const risk = computeAthleteRetentionRisk({
      ...base,
      membershipExpired: true,
    });
    expect(risk.score).toBe(35);
    expect(risk.level).toBe("medium");
    expect(risk.reasons).toContain(RETENTION_REASON.membershipExpired);
  });

  it("adds no weekly booking signal", () => {
    const risk = computeAthleteRetentionRisk({
      ...base,
      noWeekBooking: true,
    });
    expect(risk.score).toBe(15);
    expect(risk.level).toBe("low");
    expect(risk.reasons).toContain(RETENTION_REASON.noWeekBooking);
  });

  it("dampens new athletes without history", () => {
    const risk = computeAthleteRetentionRisk({
      ...base,
      daysSinceLastAttendance: null,
      noWeekBooking: true,
      isNewAthlete: true,
      membershipExpiringSoon: true,
      pendingPayment: true,
    });
    expect(risk.score).toBeLessThanOrEqual(40);
    expect(risk.reasons).toContain(RETENTION_REASON.newAthlete);
    expect(risk.reasons).not.toContain(RETENTION_REASON.neverAttended);
    expect(risk.reasons).not.toContain(RETENTION_REASON.noWeekBooking);
  });

  it("combines multiple signals and clamps to 100", () => {
    const risk = computeAthleteRetentionRisk({
      ...base,
      daysSinceLastAttendance: 20,
      noWeekBooking: true,
      membershipExpired: true,
      pendingPayment: true,
      accountInactive: true,
      recentAttendanceCount: 0,
      priorAttendanceCount: 4,
    });
    expect(risk.score).toBe(100);
    expect(risk.level).toBe("high");
    expect(risk.reasons.length).toBeGreaterThanOrEqual(4);
  });

  it("enforces minimum score of 0", () => {
    const risk = computeAthleteRetentionRisk(base);
    expect(risk.score).toBeGreaterThanOrEqual(0);
  });

  it("marks never-attended non-new athletes mildly", () => {
    const risk = computeAthleteRetentionRisk({
      ...base,
      daysSinceLastAttendance: null,
      isNewAthlete: false,
    });
    expect(risk.score).toBe(10);
    expect(risk.reasons).toContain(RETENTION_REASON.neverAttended);
  });

  it("applies attendance drop only with enough prior history", () => {
    const ignored = computeAthleteRetentionRisk({
      ...base,
      recentAttendanceCount: 0,
      priorAttendanceCount: 1,
    });
    expect(ignored.reasons).not.toContain(RETENTION_REASON.attendanceDrop);

    const applied = computeAthleteRetentionRisk({
      ...base,
      recentAttendanceCount: 0,
      priorAttendanceCount: 4,
    });
    expect(applied.score).toBe(15);
    expect(applied.reasons).toContain(RETENTION_REASON.attendanceDrop);
  });
});

describe("sortAttentionCases", () => {
  it("orders by level, score, days without attendance, then name", () => {
    const sorted = sortAttentionCases(
      [
        {
          level: "medium" as const,
          score: 30,
          daysSinceAttendance: 8,
          nombre: "Zoe",
        },
        {
          level: "high" as const,
          score: 40,
          daysSinceAttendance: 5,
          nombre: "Ana",
        },
        {
          level: "high" as const,
          score: 60,
          daysSinceAttendance: 12,
          nombre: "Luis",
        },
        {
          level: "high" as const,
          score: 60,
          daysSinceAttendance: 12,
          nombre: "Ana",
        },
      ],
      8
    );

    expect(sorted.map((c) => c.nombre)).toEqual(["Ana", "Luis", "Ana", "Zoe"]);
    expect(sorted[0].score).toBe(60);
    expect(sorted[1].score).toBe(60);
  });

  it("limits to the requested maximum", () => {
    const sorted = sortAttentionCases(
      Array.from({ length: 12 }, (_, i) => ({
        level: "medium" as const,
        score: i,
        daysSinceAttendance: i,
        nombre: `A${i}`,
      })),
      5
    );
    expect(sorted).toHaveLength(5);
  });
});
