import { afterEach, describe, expect, it, vi } from "vitest";
import {
  inclusiveDayCount,
  isReportRangeSelectable,
  MAX_REPORT_RANGE_DAYS,
  previousPeriodOfEqualDuration,
  resolveReportPeriod,
  validateReportDateRange,
} from "./period-range";

describe("period-range", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a valid inclusive range", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T18:00:00.000Z"));
    const result = validateReportDateRange(
      "America/Mexico_City",
      "2026-07-01",
      "2026-07-22"
    );
    expect(result).toEqual({
      ok: true,
      range: { from: "2026-07-01", to: "2026-07-22" },
    });
  });

  it("accepts from equal to to", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T18:00:00.000Z"));
    expect(
      validateReportDateRange(
        "America/Mexico_City",
        "2026-07-20",
        "2026-07-20"
      ).ok
    ).toBe(true);
    expect(inclusiveDayCount("2026-07-20", "2026-07-20")).toBe(1);
  });

  it("rejects from greater than to", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T18:00:00.000Z"));
    expect(
      validateReportDateRange(
        "America/Mexico_City",
        "2026-07-22",
        "2026-07-01"
      )
    ).toEqual({ ok: false, error: "inverted" });
    expect(
      isReportRangeSelectable(
        "America/Mexico_City",
        "2026-07-22",
        "2026-07-01"
      )
    ).toBe(false);
  });

  it("rejects ranges longer than 31 inclusive days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T18:00:00.000Z"));
    const result = validateReportDateRange(
      "America/Mexico_City",
      "2026-06-01",
      "2026-07-22"
    );
    expect(result).toEqual({ ok: false, error: "too_long" });
    expect(MAX_REPORT_RANGE_DAYS).toBe(31);
  });

  it("rejects future dates in box timezone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T18:00:00.000Z"));
    expect(
      validateReportDateRange(
        "America/Mexico_City",
        "2026-07-20",
        "2026-07-23"
      )
    ).toEqual({ ok: false, error: "future" });
  });

  it("computes previous period of equal duration", () => {
    // 10–20 Jul = 11 days → 29 Jun–9 Jul
    expect(
      previousPeriodOfEqualDuration({
        from: "2026-07-10",
        to: "2026-07-20",
      })
    ).toEqual({ from: "2026-06-29", to: "2026-07-09" });

    expect(
      inclusiveDayCount("2026-07-10", "2026-07-20")
    ).toBe(
      inclusiveDayCount("2026-06-29", "2026-07-09")
    );
  });

  it("resolves from+to as custom range", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T18:00:00.000Z"));
    const result = resolveReportPeriod("America/Mexico_City", {
      from: "2026-07-01",
      to: "2026-07-15",
    });
    expect(result).toEqual({
      ok: true,
      range: { from: "2026-07-01", to: "2026-07-15" },
    });
  });

  it("keeps legacy Monday-only from as full week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T18:00:00.000Z"));
    const result = resolveReportPeriod("America/Mexico_City", {
      from: "2026-07-13",
      to: null,
    });
    expect(result).toEqual({
      ok: true,
      range: { from: "2026-07-13", to: "2026-07-19" },
    });
  });
});
