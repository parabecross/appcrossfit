import { describe, expect, it } from "vitest";
import { getDefaultRankingConfig } from "./config";
import { streakBonusForDay } from "./streak";

describe("streakBonusForDay", () => {
  const config = getDefaultRankingConfig("box-test");

  it("returns 0 for streak below 2", () => {
    expect(streakBonusForDay(0, config)).toBe(0);
    expect(streakBonusForDay(1, config)).toBe(0);
  });

  it("picks highest matching threshold", () => {
    expect(streakBonusForDay(2, config)).toBe(2);
    expect(streakBonusForDay(6, config)).toBe(10);
    expect(streakBonusForDay(7, config)).toBe(15);
    expect(streakBonusForDay(30, config)).toBe(15);
  });
});
