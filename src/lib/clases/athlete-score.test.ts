import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_CONFIG } from "@/lib/config/app-config";
import { canAthleteManageClassScore } from "./athlete-score";
import {
  addDaysToDateString,
  filterClassesForSocioMisReservas,
} from "./helpers";
import type { Clase } from "@/types/database";

const TZ = "America/Mexico_City";

/** Fixed instant: 2026-07-22 ~18:00 in Mexico City (CDT, UTC-6). */
const NOW_JUL_22_EVENING = new Date("2026-07-23T00:00:00.000Z");

/** Morning Jul 22 before a 19:00 class (09:00 CDT). */
const NOW_JUL_22_MORNING = new Date("2026-07-22T15:00:00.000Z");

describe("socio mis-reservas date range (box timezone)", () => {
  it("Jul 22 box day → loads Jul 20 … Jul 27 inclusive", () => {
    const today = "2026-07-22";
    const from = addDaysToDateString(today, -APP_CONFIG.SOCIO_CLASES_PAST_DAYS);
    const to = addDaysToDateString(today, APP_CONFIG.SOCIO_CLASES_FUTURE_DAYS);
    expect(from).toBe("2026-07-20");
    expect(to).toBe("2026-07-27");
    expect(APP_CONFIG.SOCIO_CLASES_PAST_DAYS).toBe(2);
    expect(APP_CONFIG.SOCIO_CLASES_FUTURE_DAYS).toBe(5);
  });
});

describe("canAthleteManageClassScore", () => {
  it("allows score for Jul 20, 21 and ended Jul 22 when today is Jul 22", () => {
    for (const date of ["2026-07-20", "2026-07-21", "2026-07-22"]) {
      expect(
        canAthleteManageClassScore({
          classDate: date,
          classEndTime: "08:00",
          reservationStatus: "asistio",
          timezone: TZ,
          now: NOW_JUL_22_EVENING,
        })
      ).toBe(true);
    }
  });

  it("rejects Jul 19 (more than 2 days old)", () => {
    expect(
      canAthleteManageClassScore({
        classDate: "2026-07-19",
        classEndTime: "08:00",
        reservationStatus: "asistio",
        timezone: TZ,
        now: NOW_JUL_22_EVENING,
      })
    ).toBe(false);
  });

  it("rejects no_asistio", () => {
    expect(
      canAthleteManageClassScore({
        classDate: "2026-07-21",
        classEndTime: "08:00",
        reservationStatus: "no_asistio",
        timezone: TZ,
        now: NOW_JUL_22_EVENING,
      })
    ).toBe(false);
  });

  it("rejects class that has not ended yet", () => {
    expect(
      canAthleteManageClassScore({
        classDate: "2026-07-22",
        classEndTime: "19:00",
        reservationStatus: "confirmada",
        timezone: TZ,
        now: NOW_JUL_22_MORNING,
      })
    ).toBe(false);
  });

  it("uses box timezone calendar days (not device local)", () => {
    // Instant is Jul 23 05:00 UTC = still Jul 22 evening in Mexico City
    const stillJul22InBox = new Date("2026-07-23T05:00:00.000Z");
    expect(
      canAthleteManageClassScore({
        classDate: "2026-07-20",
        classEndTime: "08:00",
        reservationStatus: "asistio",
        timezone: TZ,
        now: stillJul22InBox,
      })
    ).toBe(true);
    // Same instant in UTC+14 would be Jul 23 — box TZ must keep Jul 22 window
    expect(
      canAthleteManageClassScore({
        classDate: "2026-07-20",
        classEndTime: "08:00",
        reservationStatus: "asistio",
        timezone: "Pacific/Kiritimati",
        now: stillJul22InBox,
      })
    ).toBe(false);
  });
});

describe("filterClassesForSocioMisReservas", () => {
  const clases = [
    {
      id: "past-booked",
      fecha: "2026-07-20",
      hora_fin: "08:00",
      estado: "programada",
    },
    {
      id: "past-unbooked",
      fecha: "2026-07-20",
      hora_fin: "19:00",
      estado: "programada",
    },
    {
      id: "today",
      fecha: "2099-06-15",
      hora_fin: "19:00",
      estado: "programada",
    },
    {
      id: "future",
      fecha: "2099-06-16",
      hora_fin: "19:00",
      estado: "programada",
    },
  ] as Clase[];

  it("hides past classes without reservation; keeps today/future", () => {
    const filtered = filterClassesForSocioMisReservas(
      clases,
      [{ clase_id: "past-booked", usuario_id: "u1" }],
      "u1",
      TZ
    );
    const ids = filtered.map((c) => c.id);
    expect(ids).toContain("past-booked");
    expect(ids).not.toContain("past-unbooked");
    expect(ids).toContain("today");
    expect(ids).toContain("future");
  });
});

describe("score API server guard (shared helper)", () => {
  const SCORE_WINDOW_CLOSED = "SCORE_WINDOW_CLOSED";

  function serverWouldReject(input: Parameters<typeof canAthleteManageClassScore>[0]) {
    if (!canAthleteManageClassScore(input)) {
      return { status: 403 as const, error: SCORE_WINDOW_CLOSED };
    }
    return null;
  }

  it("rejects upsert outside the 2-day window", () => {
    const rejection = serverWouldReject({
      classDate: "2026-07-19",
      classEndTime: "08:00",
      reservationStatus: "asistio",
      timezone: TZ,
      now: NOW_JUL_22_EVENING,
    });
    expect(rejection).toEqual({ status: 403, error: SCORE_WINDOW_CLOSED });
  });

  it("allows upsert inside the window", () => {
    expect(
      serverWouldReject({
        classDate: "2026-07-21",
        classEndTime: "08:00",
        reservationStatus: "confirmada",
        timezone: TZ,
        now: NOW_JUL_22_EVENING,
      })
    ).toBeNull();
  });
});

describe("mis-reservas page composition", () => {
  const root = join(process.cwd(), "src");

  it("does not load progress, insignias, ranking or membership card", () => {
    const page = readFileSync(
      join(root, "app/[locale]/(socio)/mis-reservas/page.tsx"),
      "utf8"
    );
    const dashboard = readFileSync(
      join(root, "components/socio/home/athlete-home-dashboard.tsx"),
      "utf8"
    );

    expect(page).not.toMatch(/getAtletaProgreso/);
    expect(page).not.toMatch(/getUserAthronSummary/);
    expect(page).not.toMatch(/atleta_objetivos/);
    expect(page).not.toMatch(/AthleteHomeSecondary/);
    expect(page).not.toMatch(/AthleteMembershipCard/);
    expect(dashboard).not.toMatch(/AthleteMembershipCard/);
    expect(dashboard).not.toMatch(/AthleteProgressSnapshot|AthleteBadges|AthleteRanking/);
    expect(page).toMatch(/AthleteHomeConstancy/);
    expect(page).toMatch(/AthleteHomeHistorySection/);
  });
});
