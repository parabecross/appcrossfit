import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatWeekRangeForReport,
  getCurrentWeekRange,
  getPriorWeekRange,
  listRecentWeekOptions,
  resolveRequestedWeekRange,
  weekRangeQueryBounds,
} from "./week-range";

describe("reporte-semanal week-range", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns Monday–Sunday for mid-week in Mexico City", () => {
    // Wednesday 2026-07-22 18:00 UTC ≈ afternoon CDMX
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T18:00:00.000Z"));

    const week = getCurrentWeekRange("America/Mexico_City");
    expect(week).toEqual({ from: "2026-07-20", to: "2026-07-26" });
    expect(weekRangeQueryBounds(week)).toEqual({
      fromInclusive: "2026-07-20",
      toInclusive: "2026-07-26",
    });
  });

  it("handles Sunday as end of the same week", () => {
    vi.useFakeTimers();
    // Sunday Jul 26 2026 20:00 CDMX ≈ 2026-07-27T02:00Z
    vi.setSystemTime(new Date("2026-07-27T02:00:00.000Z"));

    const week = getCurrentWeekRange("America/Mexico_City");
    expect(week.from).toBe("2026-07-20");
    expect(week.to).toBe("2026-07-26");
  });

  it("handles Monday as start of week", () => {
    vi.useFakeTimers();
    // Monday Jul 20 2026 10:00 CDMX ≈ 2026-07-20T16:00Z
    vi.setSystemTime(new Date("2026-07-20T16:00:00.000Z"));

    const week = getCurrentWeekRange("America/Mexico_City");
    expect(week).toEqual({ from: "2026-07-20", to: "2026-07-26" });
  });

  it("previous week is the prior Monday–Sunday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T18:00:00.000Z"));

    const prev = getPriorWeekRange("America/Mexico_City");
    expect(prev).toEqual({ from: "2026-07-13", to: "2026-07-19" });
  });

  it("formats range in Spanish", () => {
    const label = formatWeekRangeForReport(
      { from: "2026-07-20", to: "2026-07-26" },
      "es"
    );
    expect(label).toContain("2026");
    expect(label).toContain("–");
  });

  it("uses box timezone, not UTC day boundary alone", () => {
    vi.useFakeTimers();
    // 2026-07-20 05:00 UTC is still Sunday Jul 19 in Mexico City
    vi.setSystemTime(new Date("2026-07-20T05:00:00.000Z"));
    const week = getCurrentWeekRange("America/Mexico_City");
    expect(week).toEqual({ from: "2026-07-13", to: "2026-07-19" });
  });

  it("resolves an explicit Monday week within lookback", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T18:00:00.000Z"));
    const ok = resolveRequestedWeekRange(
      "America/Mexico_City",
      "2026-07-13"
    );
    expect(ok).toEqual({
      ok: true,
      week: { from: "2026-07-13", to: "2026-07-19" },
    });
  });

  it("rejects non-Monday and future weeks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T18:00:00.000Z"));
    expect(
      resolveRequestedWeekRange("America/Mexico_City", "2026-07-21").ok
    ).toBe(false);
    expect(
      resolveRequestedWeekRange("America/Mexico_City", "2026-07-27").ok
    ).toBe(false);
  });

  it("lists recent week options with current first", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T18:00:00.000Z"));
    const options = listRecentWeekOptions("America/Mexico_City", "es", 3);
    expect(options).toHaveLength(3);
    expect(options[0]).toMatchObject({
      from: "2026-07-20",
      to: "2026-07-26",
      isCurrent: true,
    });
    expect(options[1].from).toBe("2026-07-13");
    expect(options[2].isCurrent).toBe(false);
  });
});
