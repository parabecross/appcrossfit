import { describe, expect, it } from "vitest";
import {
  computeAttendanceStreak,
  computeAttendanceStats,
  computeClassesInRange,
} from "./attendance";
import { addDaysToDateString, todayInTimezone } from "@/lib/dates/date-only";

describe("computeAttendanceStreak", () => {
  it("returns 0 with no dates", () => {
    expect(computeAttendanceStreak([], "2026-07-15")).toBe(0);
  });

  it("counts consecutive calendar days ending today", () => {
    expect(
      computeAttendanceStreak(
        ["2026-07-15", "2026-07-14", "2026-07-13"],
        "2026-07-15"
      )
    ).toBe(3);
  });

  it("allows streak starting yesterday if not trained today", () => {
    expect(
      computeAttendanceStreak(["2026-07-14", "2026-07-13"], "2026-07-15")
    ).toBe(2);
  });

  it("resets when there is a gap before yesterday", () => {
    expect(
      computeAttendanceStreak(["2026-07-12", "2026-07-11"], "2026-07-15")
    ).toBe(0);
  });

  it("dedupes same-day dates via unique set usage in stats", () => {
    const tz = "America/Mexico_City";
    const today = todayInTimezone(tz);
    const yesterday = addDaysToDateString(today, -1);
    const weekFrom = addDaysToDateString(today, -2);
    const weekTo = addDaysToDateString(today, 4);
    const stats = computeAttendanceStats(
      [{ fecha: today }, { fecha: today }, { fecha: yesterday }],
      tz,
      { from: weekFrom, to: weekTo }
    );
    // streak uses unique days
    expect(stats.streak).toBeGreaterThanOrEqual(1);
    expect(stats.uniqueTrainingDays).toBe(2);
  });
});

describe("computeClassesInRange / week-month", () => {
  it("counts classes in week and month ranges", () => {
    const records = [
      { fecha: "2026-07-14" },
      { fecha: "2026-07-15" },
      { fecha: "2026-06-30" },
    ];
    expect(computeClassesInRange(records, "2026-07-13", "2026-07-19")).toBe(2);
    expect(computeClassesInRange(records, "2026-07-01", "2026-07-15")).toBe(2);
  });

  it("includes classesThisWeek when weekRange provided", () => {
    const stats = computeAttendanceStats(
      [
        { fecha: "2026-07-14" },
        { fecha: "2026-07-10" },
        { fecha: "2026-06-01" },
      ],
      "America/Mexico_City",
      { from: "2026-07-13", to: "2026-07-19" }
    );
    expect(stats.classesThisWeek).toBe(1);
  });
});
