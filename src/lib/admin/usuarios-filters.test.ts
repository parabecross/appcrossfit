import { describe, expect, it } from "vitest";
import {
  athleteMatchesInboxView,
  buildUsuariosInboxHref,
  countInboxViews,
  decodeUsuariosReturnParam,
  encodeUsuariosReturnParam,
  filterAthleteInboxRows,
  parseUsuariosInboxFilters,
  USUARIOS_DEEP_LINKS,
} from "./usuarios-filters";
import {
  buildAttentionPriorities,
  countAttentionKpis,
  formatLastAttendanceLabel,
  formatMembershipSummary,
  resolveAttentionCenterStatus,
} from "./attention-center-display";

const base = {
  id: "1",
  nombre_completo: "Ana López",
  telefono: "5512345678",
  level: "high" as const,
  score: 60,
  daysSinceAttendance: 12,
  membershipStatus: "vencida" as string | null,
  reasons: ["membership_expired", "inactive_10"],
  hasWeekBooking: false,
};

describe("parseUsuariosInboxFilters", () => {
  it("defaults to all and ignores unknown values", () => {
    expect(parseUsuariosInboxFilters({})).toEqual({ view: "all", q: "" });
    expect(
      parseUsuariosInboxFilters({ view: "nope", attention: "weird" })
    ).toEqual({ view: "all", q: "" });
  });

  it("parses simplified views and legacy aliases", () => {
    expect(parseUsuariosInboxFilters({ view: "inactive" }).view).toBe(
      "inactive"
    );
    expect(parseUsuariosInboxFilters({ view: "active" }).view).toBe("active");
    expect(parseUsuariosInboxFilters({ view: "attention_high" }).view).toBe(
      "inactive"
    );
    expect(parseUsuariosInboxFilters({ attention: "high" }).view).toBe(
      "inactive"
    );
    expect(parseUsuariosInboxFilters({ membership: "expired" }).view).toBe(
      "membership_expired"
    );
    expect(parseUsuariosInboxFilters({ payment: "pending" }).view).toBe(
      "membership_expiring"
    );
    expect(parseUsuariosInboxFilters({ attendance: "inactive" }).view).toBe(
      "inactive"
    );
  });

  it("keeps search query", () => {
    expect(parseUsuariosInboxFilters({ q: " ana " }).q).toBe("ana");
  });
});

describe("buildUsuariosInboxHref / deep links", () => {
  it("builds clean URLs", () => {
    expect(buildUsuariosInboxHref({ view: "all" })).toBe("/admin/usuarios");
    expect(buildUsuariosInboxHref({ view: "inactive" })).toBe(
      "/admin/usuarios?view=inactive"
    );
    expect(USUARIOS_DEEP_LINKS.needsAttention).toContain("inactive");
    expect(USUARIOS_DEEP_LINKS.paymentPending).toContain("membership_expiring");
  });

  it("round-trips return params", () => {
    const ret = encodeUsuariosReturnParam({
      view: "inactive",
      q: "luis",
    });
    expect(decodeUsuariosReturnParam(ret)).toContain("view=inactive");
    expect(decodeUsuariosReturnParam(null)).toBe("/admin/usuarios");
  });
});

describe("attention center status priority", () => {
  it("prioritizes expired over inactive", () => {
    expect(
      resolveAttentionCenterStatus({
        membershipStatus: "vencida",
        daysSinceAttendance: 20,
        reasons: ["inactive_15"],
      })
    ).toBe("vencido");
  });

  it("uses inactive when membership is healthy", () => {
    expect(
      resolveAttentionCenterStatus({
        membershipStatus: "activo",
        daysSinceAttendance: 11,
        reasons: ["inactive_10"],
      })
    ).toBe("sin_asistir");
  });

  it("formats attendance and membership lines", () => {
    expect(
      formatLastAttendanceLabel(0, {
        today: "Hoy",
        daysAgo: (n) => `Hace ${n} días`,
        never: "—",
      })
    ).toBe("Hoy");
    expect(
      formatLastAttendanceLabel(7, {
        today: "Hoy",
        daysAgo: (n) => `Hace ${n} días`,
        never: "—",
      })
    ).toBe("Hace 7 días");
    expect(
      formatMembershipSummary(
        {
          membershipStatus: "activo",
          fechaFin: "2026-07-25",
          today: "2026-07-22",
        },
        {
          active: "Activa",
          expiresIn: (d) => `Vence en ${d} días`,
          expiredAgo: (d) => `Venció hace ${d} días`,
          none: "Sin membresía",
        }
      )
    ).toBe("Activa");
    expect(
      formatMembershipSummary(
        {
          membershipStatus: "por_vencer",
          fechaFin: "2026-07-25",
          today: "2026-07-22",
        },
        {
          active: "Activa",
          expiresIn: (d) => `Vence en ${d} días`,
          expiredAgo: (d) => `Venció hace ${d} días`,
          none: "Sin membresía",
        }
      )
    ).toBe("Vence en 3 días");
  });
});

describe("filterAthleteInboxRows", () => {
  const rows = [
    base,
    {
      ...base,
      id: "2",
      nombre_completo: "Luis",
      level: "medium" as const,
      score: 30,
      daysSinceAttendance: 8,
      membershipStatus: "por_vencer",
      reasons: ["membership_expiring"],
      hasWeekBooking: true,
    },
    {
      ...base,
      id: "3",
      nombre_completo: "Zoe",
      level: "low" as const,
      score: 0,
      daysSinceAttendance: 1,
      membershipStatus: "activo",
      reasons: [],
      hasWeekBooking: true,
      telefono: null,
    },
    {
      ...base,
      id: "4",
      nombre_completo: "Nuevo",
      daysSinceAttendance: 2,
      membershipStatus: "activo",
      reasons: ["new_athlete"],
      hasWeekBooking: false,
    },
  ];

  it("filters inactive at +10 days", () => {
    const filtered = filterAthleteInboxRows(rows, {
      view: "inactive",
      q: "",
    });
    expect(filtered.map((r) => r.id)).toEqual(["1"]);
  });

  it("filters expired and expiring", () => {
    expect(
      filterAthleteInboxRows(rows, { view: "membership_expired", q: "" }).map(
        (r) => r.id
      )
    ).toEqual(["1"]);
    expect(
      filterAthleteInboxRows(rows, {
        view: "membership_expiring",
        q: "",
      }).map((r) => r.id)
    ).toEqual(["2"]);
  });

  it("matches search by name and phone", () => {
    expect(
      filterAthleteInboxRows(rows, { view: "all", q: "zoe" }).map((r) => r.id)
    ).toEqual(["3"]);
    expect(
      filterAthleteInboxRows(rows, { view: "all", q: "5512345678" }).map(
        (r) => r.id
      )
    ).toEqual(["1", "2", "4"]);
  });

  it("filters new without booking separately from inactive", () => {
    const filtered = filterAthleteInboxRows(rows, {
      view: "new_without_booking",
      q: "",
    });
    expect(filtered.map((r) => r.id)).toEqual(["4"]);
  });

  it("counts kpis and priorities without extra queries", () => {
    const counts = countInboxViews(rows);
    expect(counts.all).toBe(4);
    expect(counts.inactive).toBe(1);
    expect(counts.membership_expired).toBe(1);
    expect(counts.membership_expiring).toBe(1);
    expect(counts.active).toBe(2);
    expect(counts.new_without_booking).toBe(1);

    const kpis = countAttentionKpis(rows);
    expect(kpis.total).toBe(4);
    expect(kpis.inactive).toBe(1);

    const priorities = buildAttentionPriorities(rows);
    expect(priorities.newWithoutBooking).toBe(1);
    expect(priorities.expired).toBe(1);
  });

  it("matches athlete helpers", () => {
    expect(athleteMatchesInboxView(base, "membership_expired")).toBe(true);
    expect(
      athleteMatchesInboxView(
        { ...base, membershipStatus: "activo", daysSinceAttendance: 11 },
        "inactive"
      )
    ).toBe(true);
  });
});
