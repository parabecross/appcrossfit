import { describe, expect, it } from "vitest";
import {
  getDailyMotivationMessage,
  getDayOfYearFromDateString,
} from "./get-daily-message";

describe("getDayOfYearFromDateString", () => {
  it("returns stable day index for YYYY-MM-DD", () => {
    expect(getDayOfYearFromDateString("2026-01-01")).toBe(1);
    expect(getDayOfYearFromDateString("2026-07-01")).toBe(182);
  });
});

describe("getDailyMotivationMessage", () => {
  it("picks the same message for the same today string", () => {
    const a = getDailyMotivationMessage("athlete", "es", "2026-07-01");
    const b = getDailyMotivationMessage("athlete", "es", "2026-07-01");
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
});
