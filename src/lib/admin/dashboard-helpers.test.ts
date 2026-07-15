import { describe, expect, it } from "vitest";
import {
  computeAvailableSpots,
  filterFullClasses,
  filterLowOccupancyClasses,
  getCupoStatus,
} from "./dashboard-helpers";

describe("occupancy helpers", () => {
  it("computes available spots from real cupos", () => {
    expect(
      computeAvailableSpots([
        { cupo_ocupado: 8, cupo_maximo: 12 },
        { cupo_ocupado: 12, cupo_maximo: 12 },
        { cupo_ocupado: 0, cupo_maximo: 10 },
      ])
    ).toBe(14);
  });

  it("ignores classes without capacity", () => {
    expect(
      computeAvailableSpots([{ cupo_ocupado: 0, cupo_maximo: 0 }])
    ).toBe(0);
  });

  it("classifies cupo status", () => {
    expect(getCupoStatus(12, 12)).toBe("full");
    expect(getCupoStatus(9, 12)).toBe("almost_full");
    expect(getCupoStatus(3, 12)).toBe("available");
  });

  it("filters full and low-occupancy classes", () => {
    const classes = [
      { id: "a", cupo_ocupado: 12, cupo_maximo: 12 },
      { id: "b", cupo_ocupado: 2, cupo_maximo: 12 },
      { id: "c", cupo_ocupado: 8, cupo_maximo: 12 },
    ];
    expect(filterFullClasses(classes).map((c) => c.id)).toEqual(["a"]);
    expect(filterLowOccupancyClasses(classes).map((c) => c.id)).toEqual(["b"]);
  });
});
