import { describe, expect, it } from "vitest";
import {
  getClassTimeBlock,
  summarizeWorkout,
  occupancyTone,
} from "./workout-summary";

describe("summarizeWorkout", () => {
  it("returns first lines only", () => {
    expect(
      summarizeWorkout("Fuerza: Back Squat 5x5\n\nMetcon: 12-9-6\nExtra", 2)
    ).toEqual(["Fuerza: Back Squat 5x5", "Metcon: 12-9-6"]);
  });
});

describe("getClassTimeBlock", () => {
  it("groups by time of day", () => {
    expect(getClassTimeBlock("07:00")).toBe("morning");
    expect(getClassTimeBlock("14:30")).toBe("afternoon");
    expect(getClassTimeBlock("19:00")).toBe("evening");
  });
});

describe("occupancyTone", () => {
  it("uses thresholds", () => {
    expect(occupancyTone(6, 10)).toBe("low");
    expect(occupancyTone(8, 10)).toBe("medium");
    expect(occupancyTone(10, 10)).toBe("high");
  });
});
