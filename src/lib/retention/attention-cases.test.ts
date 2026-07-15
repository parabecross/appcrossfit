import { describe, expect, it } from "vitest";
import { buildAttentionCases } from "./attention-cases";

describe("buildAttentionCases", () => {
  it("returns empty when there are no signals", () => {
    expect(
      buildAttentionCases({
        today: "2026-07-15",
        membershipExpired: [],
        membershipExpiring: [],
        pendingPaymentAthletes: [],
        inactiveAthletes: [],
        athletesWithoutWeekBooking: [],
      })
    ).toEqual([]);
  });

  it("prioritizes expired memberships over inactivity", () => {
    const cases = buildAttentionCases({
      today: "2026-07-15",
      membershipExpired: [
        {
          profile_id: "1",
          nombre_completo: "Ana",
          telefono: "5512345678",
          user_id: "u1",
          plan_nombre: "Mensual",
          fecha_fin: "2026-07-01",
          tipo_alerta: "vencida",
        },
      ],
      membershipExpiring: [],
      pendingPaymentAthletes: [],
      inactiveAthletes: [
        {
          profileId: "2",
          nombre: "Luis",
          daysSinceAttendance: 12,
        },
      ],
      athletesWithoutWeekBooking: [],
      limit: 8,
    });

    expect(cases[0].profileId).toBe("1");
    expect(cases[0].kind).toBe("membership_expired");
    expect(cases[0].level).toBe("medium");
  });

  it("merges signals for the same athlete", () => {
    const cases = buildAttentionCases({
      today: "2026-07-15",
      membershipExpired: [
        {
          profile_id: "1",
          nombre_completo: "Ana",
          telefono: "5512345678",
          user_id: "u1",
          plan_nombre: "Mensual",
          fecha_fin: "2026-07-01",
          tipo_alerta: "vencida",
        },
      ],
      membershipExpiring: [],
      pendingPaymentAthletes: [],
      inactiveAthletes: [
        {
          profileId: "1",
          nombre: "Ana",
          daysSinceAttendance: 18,
          telefono: "5512345678",
        },
      ],
      athletesWithoutWeekBooking: [],
    });

    expect(cases).toHaveLength(1);
    expect(cases[0].score).toBeGreaterThanOrEqual(35);
    expect(cases[0].reasons.length).toBeGreaterThanOrEqual(2);
    expect(cases[0].daysSinceAttendance).toBe(18);
  });

  it("caps the inbox size", () => {
    const cases = buildAttentionCases({
      today: "2026-07-15",
      membershipExpired: [],
      membershipExpiring: [],
      pendingPaymentAthletes: [],
      inactiveAthletes: Array.from({ length: 20 }, (_, i) => ({
        profileId: `p${i}`,
        nombre: `Athlete ${i}`,
        daysSinceAttendance: 10 + i,
      })),
      athletesWithoutWeekBooking: [],
      limit: 6,
    });
    expect(cases).toHaveLength(6);
  });
});
