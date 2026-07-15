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

  it("parses view and deep-link aliases", () => {
    expect(parseUsuariosInboxFilters({ view: "attention_high" }).view).toBe(
      "attention_high"
    );
    expect(parseUsuariosInboxFilters({ attention: "high" }).view).toBe(
      "attention_high"
    );
    expect(parseUsuariosInboxFilters({ membership: "expired" }).view).toBe(
      "membership_expired"
    );
    expect(parseUsuariosInboxFilters({ payment: "pending" }).view).toBe(
      "payment_pending"
    );
    expect(parseUsuariosInboxFilters({ attendance: "inactive" }).view).toBe(
      "inactive"
    );
    expect(parseUsuariosInboxFilters({ reservation: "missing" }).view).toBe(
      "no_reservation"
    );
  });

  it("keeps search query", () => {
    expect(parseUsuariosInboxFilters({ q: " ana " }).q).toBe("ana");
  });
});

describe("buildUsuariosInboxHref / deep links", () => {
  it("builds clean URLs", () => {
    expect(buildUsuariosInboxHref({ view: "all" })).toBe("/admin/usuarios");
    expect(buildUsuariosInboxHref({ view: "attention_high" })).toBe(
      "/admin/usuarios?view=attention_high"
    );
    expect(USUARIOS_DEEP_LINKS.needsAttention).toContain("attention_high");
    expect(USUARIOS_DEEP_LINKS.paymentPending).toContain("payment_pending");
  });

  it("round-trips return params", () => {
    const ret = encodeUsuariosReturnParam({
      view: "inactive",
      q: "luis",
    });
    expect(decodeUsuariosReturnParam(ret)).toContain("view=inactive");
    expect(decodeUsuariosReturnParam(null)).toBe("/admin/usuarios");
  });
  it("parses follow-up and contact views / aliases", () => {
    expect(parseUsuariosInboxFilters({ view: "follow_up_overdue" }).view).toBe(
      "follow_up_overdue"
    );
    expect(parseUsuariosInboxFilters({ follow_up: "today" }).view).toBe(
      "follow_up_today"
    );
    expect(parseUsuariosInboxFilters({ contact: "never" }).view).toBe(
      "never_contacted"
    );
    expect(parseUsuariosInboxFilters({ contact: "recent" }).view).toBe(
      "recently_contacted"
    );
    expect(USUARIOS_DEEP_LINKS.followUpOverdue).toContain("follow_up_overdue");
    expect(USUARIOS_DEEP_LINKS.neverContacted).toContain("never_contacted");
  });
});

describe("follow-up inbox matching and sort", () => {
  const withFollow = [
    {
      ...base,
      id: "a",
      nombre_completo: "Zoe",
      score: 10,
      level: "high" as const,
      followUpStatus: "scheduled" as const,
      neverContacted: false,
      recentlyContacted: true,
      daysSinceAttendance: 2,
    },
    {
      ...base,
      id: "b",
      nombre_completo: "Ana",
      score: 50,
      level: "high" as const,
      followUpStatus: "overdue" as const,
      neverContacted: false,
      recentlyContacted: false,
      daysSinceAttendance: 5,
    },
    {
      ...base,
      id: "c",
      nombre_completo: "Luis",
      score: 80,
      level: "high" as const,
      followUpStatus: "never_contacted" as const,
      neverContacted: true,
      recentlyContacted: false,
      daysSinceAttendance: 9,
    },
    {
      ...base,
      id: "d",
      nombre_completo: "Mia",
      score: 40,
      level: "high" as const,
      followUpStatus: "today" as const,
      neverContacted: false,
      recentlyContacted: true,
      daysSinceAttendance: 3,
    },
  ];

  it("matches follow-up views", () => {
    expect(athleteMatchesInboxView(withFollow[1], "follow_up_overdue")).toBe(
      true
    );
    expect(athleteMatchesInboxView(withFollow[2], "never_contacted")).toBe(
      true
    );
    expect(athleteMatchesInboxView(withFollow[0], "recently_contacted")).toBe(
      true
    );
  });

  it("sorts overdue → never contacted → today → score", () => {
    const filtered = filterAthleteInboxRows(withFollow, {
      view: "attention_high",
      q: "",
    });
    expect(filtered.map((r) => r.id)).toEqual(["b", "c", "d", "a"]);
  });

  it("keeps one row per athlete", () => {
    const filtered = filterAthleteInboxRows(withFollow, {
      view: "never_contacted",
      q: "",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("c");
  });

  it("counts views from snapshot without per-view queries", () => {
    const counts = countInboxViews(withFollow);
    expect(counts.all).toBe(4);
    expect(counts.follow_up_overdue).toBe(1);
    expect(counts.never_contacted).toBe(1);
    expect(counts.follow_up_today).toBe(1);
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
  ];

  it("filters attention high and sorts by score", () => {
    const filtered = filterAthleteInboxRows(rows, {
      view: "attention_high",
      q: "",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("1");
  });

  it("does not duplicate athletes", () => {
    const filtered = filterAthleteInboxRows(rows, {
      view: "membership_expired",
      q: "",
    });
    expect(filtered.map((r) => r.id)).toEqual(["1"]);
  });

  it("matches search and empty results", () => {
    expect(
      filterAthleteInboxRows(rows, { view: "all", q: "zoe" }).map((r) => r.id)
    ).toEqual(["3"]);
    expect(
      filterAthleteInboxRows(rows, { view: "attention_high", q: "zzz" })
    ).toEqual([]);
  });

  it("matches inactive and payment views", () => {
    expect(
      athleteMatchesInboxView(
        { ...base, reasons: ["inactive_15"], membershipStatus: "activo" },
        "inactive"
      )
    ).toBe(true);
    expect(
      athleteMatchesInboxView(
        {
          ...base,
          membershipStatus: "pendiente_pago",
          reasons: ["pending_payment"],
        },
        "payment_pending"
      )
    ).toBe(true);
  });
});
