import { describe, expect, it } from "vitest";
import { compareMetric, compareNullableMetric, formatComparisonLabel } from "./compare";

describe("compareMetric", () => {
  it("computes percent when previous > 0", () => {
    const c = compareMetric(110, 100);
    expect(c.absoluteDelta).toBe(10);
    expect(c.percentDelta).toBe(10);
    expect(c.label).toBe("ok");
    expect(formatComparisonLabel(c)).toContain("+10");
  });

  it("uses Nuevo registro when previous is zero and current > 0", () => {
    const c = compareMetric(5, 0);
    expect(c.label).toBe("nuevo");
    expect(c.percentDelta).toBeNull();
    expect(formatComparisonLabel(c)).toBe("Nuevo registro");
  });

  it("uses Sin cambio when both zero", () => {
    const c = compareMetric(0, 0);
    expect(c.label).toBe("sin_cambio");
    expect(formatComparisonLabel(c)).toBe("Sin cambio");
  });

  it("uses Sin datos comparables for null occupancy", () => {
    const c = compareNullableMetric(null, null);
    expect(c.label).toBe("sin_datos");
    expect(formatComparisonLabel(c)).toBe("Sin datos comparables");
  });
});
