import { describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

import { isAssignableCoach } from "./coaches";

describe("isAssignableCoach", () => {
  it("allows regular coaches", () => {
    expect(isAssignableCoach({ rol: "coach" })).toBe(true);
  });

  it("rejects super admin even with coach role", () => {
    expect(isAssignableCoach({ rol: "coach", is_super_admin: true })).toBe(
      false
    );
  });

  it("rejects box admins and admins", () => {
    expect(isAssignableCoach({ rol: "admin" })).toBe(false);
    expect(isAssignableCoach({ rol: "box_admin" })).toBe(false);
  });
});

describe("box-scoped coach filter", () => {
  it("drops coaches from another box even if returned by query", () => {
    const boxA = "box-a";
    const profiles = [
      { id: "1", box_id: boxA, rol: "coach" as const, is_super_admin: false },
      { id: "2", box_id: "box-b", rol: "coach" as const, is_super_admin: false },
    ];
    expect(
      profiles.filter((p) => p.box_id === boxA && isAssignableCoach(p))
    ).toHaveLength(1);
  });
});
