import { describe, expect, it } from "vitest";
import { buildBirthdayGreeting, getBirthdayWindow } from "./helpers";

describe("getBirthdayWindow", () => {
  it("returns today when month-day matches", () => {
    expect(getBirthdayWindow("1990-06-15", "2026-06-15")).toBe("today");
  });

  it("returns tomorrow when birthday is next calendar day", () => {
    expect(getBirthdayWindow("1990-06-16", "2026-06-15")).toBe("tomorrow");
  });

  it("returns yesterday when birthday was previous calendar day", () => {
    expect(getBirthdayWindow("1990-06-14", "2026-06-15")).toBe("yesterday");
  });

  it("returns null when fecha_nacimiento is missing", () => {
    expect(getBirthdayWindow(null, "2026-06-15")).toBeNull();
    expect(getBirthdayWindow(undefined, "2026-06-15")).toBeNull();
    expect(getBirthdayWindow("", "2026-06-15")).toBeNull();
  });

  it("handles year boundary: Jan 1 birthday on Dec 31 is tomorrow", () => {
    expect(getBirthdayWindow("1990-01-01", "2026-12-31")).toBe("tomorrow");
  });

  it("handles year boundary: Dec 31 birthday on Jan 1 is yesterday", () => {
    expect(getBirthdayWindow("1990-12-31", "2026-01-01")).toBe("yesterday");
  });

  it("does not match Feb 29 on Feb 28 in a non-leap year", () => {
    expect(getBirthdayWindow("1990-02-29", "2025-02-28")).toBeNull();
  });

  it("does not match Feb 29 on Mar 1 in a non-leap year", () => {
    expect(getBirthdayWindow("1990-02-29", "2025-03-01")).toBeNull();
  });

  it("matches Feb 29 only on Feb 29 in a leap year", () => {
    expect(getBirthdayWindow("1990-02-29", "2024-02-29")).toBe("today");
  });
});

describe("buildBirthdayGreeting", () => {
  it("uses first name in Spanish", () => {
    const msg = buildBirthdayGreeting("María López", "es", 30);
    expect(msg).toContain("María");
    expect(msg).toContain("¡Feliz cumpleaños");
  });

  it("uses first name in English", () => {
    const msg = buildBirthdayGreeting("John Smith", "en", null);
    expect(msg).toContain("John");
    expect(msg).toContain("Happy birthday");
  });

  it("works when age is null", () => {
    const msg = buildBirthdayGreeting("Ana Ruiz", "es", null);
    expect(msg.length).toBeGreaterThan(20);
    expect(msg).not.toContain("null");
  });
});
