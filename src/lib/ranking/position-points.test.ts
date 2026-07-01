import { describe, expect, it } from "vitest";
import { getDefaultRankingConfig } from "./config";
import { pointsForRank } from "./position-points";

describe("pointsForRank", () => {
  const config = getDefaultRankingConfig("box-test");

  it("returns 0 for invalid rank", () => {
    expect(pointsForRank(0, config)).toBe(0);
    expect(pointsForRank(-1, config)).toBe(0);
  });

  it("uses table for ranks within length", () => {
    expect(pointsForRank(1, config)).toBe(30);
    expect(pointsForRank(10, config)).toBe(12);
  });

  it("applies linear drop beyond table with floor", () => {
    expect(pointsForRank(11, config)).toBe(10);
    expect(pointsForRank(20, config)).toBe(config.position_points_floor);
  });

  it("handles ties at floor for very high ranks", () => {
    expect(pointsForRank(100, config)).toBe(config.position_points_floor);
  });
});
