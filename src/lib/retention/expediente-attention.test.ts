import { describe, expect, it } from "vitest";
import { computeAthleteRetentionRisk } from "@/lib/retention/athlete-risk";

describe("expediente attention signals reuse the same risk helper", () => {
  it("elevates expired membership", () => {
    const result = computeAthleteRetentionRisk({
      daysSinceLastAttendance: 14,
      noWeekBooking: true,
      membershipExpired: true,
      membershipExpiringSoon: false,
      pendingPayment: false,
      accountInactive: false,
      isNewAthlete: false,
    });
    expect(result.reasons).toContain("membership_expired");
    expect(result.level).not.toBe("low");
  });

  it("dampens new athletes without history", () => {
    const result = computeAthleteRetentionRisk({
      daysSinceLastAttendance: null,
      noWeekBooking: true,
      membershipExpired: false,
      membershipExpiringSoon: false,
      pendingPayment: false,
      accountInactive: false,
      isNewAthlete: true,
    });
    expect(result.score).toBeLessThanOrEqual(40);
    expect(result.reasons).toContain("new_athlete");
  });
});
