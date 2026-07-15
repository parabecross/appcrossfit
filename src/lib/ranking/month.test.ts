import { describe, expect, it } from "vitest";
import {
  formatMonthKeyLabel,
  formatMonthKeyLabelTitle,
  isValidMonthKey,
} from "./month";

describe("ranking month helpers", () => {
  it("validates month keys", () => {
    expect(isValidMonthKey("2026-07")).toBe(true);
    expect(isValidMonthKey("2026-13")).toBe(false);
    expect(isValidMonthKey("2026-7")).toBe(false);
    expect(isValidMonthKey(undefined)).toBe(false);
  });

  it("formats July without UTC shift to June", () => {
    const label = formatMonthKeyLabel("2026-07", "es");
    expect(label.toLowerCase()).toContain("julio");
    expect(label).toContain("2026");
    expect(label.toLowerCase()).not.toContain("junio");
  });

  it("formats English July", () => {
    const label = formatMonthKeyLabel("2026-07", "en");
    expect(label.toLowerCase()).toContain("july");
  });

  it("title-cases Spanish month labels", () => {
    const title = formatMonthKeyLabelTitle("2026-06", "es");
    expect(title.charAt(0)).toBe(title.charAt(0).toUpperCase());
    expect(title.toLowerCase()).toContain("junio");
  });
});
