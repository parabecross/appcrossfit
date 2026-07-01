import { describe, expect, it } from "vitest";
import { parseRankingConfigPatch } from "./parse-config-patch";

describe("parseRankingConfigPatch", () => {
  it("rejects empty body", () => {
    const result = parseRankingConfigPatch({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors._body).toBeDefined();
    }
  });

  it("rejects box_id override attempts", () => {
    const result = parseRankingConfigPatch({
      box_id: "other-box",
      attendance_points: 5,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect("box_id" in result.patch).toBe(false);
      expect(result.patch.attendance_points).toBe(5);
    }
  });

  it("rejects negative points", () => {
    const result = parseRankingConfigPatch({ attendance_points: -1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.attendance_points).toBeDefined();
    }
  });

  it("accepts valid partial patch", () => {
    const result = parseRankingConfigPatch({
      enabled: false,
      min_attendances_to_rank: 3,
      tagline: "Liga del box",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch).toEqual({
        enabled: false,
        min_attendances_to_rank: 3,
        tagline: "Liga del box",
      });
    }
  });
});
