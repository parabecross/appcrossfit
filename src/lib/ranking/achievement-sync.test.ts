import { describe, expect, it } from "vitest";
import {
  isSkillAchieved,
  skillBadgeKey,
} from "./achievement-sync";
import type { AtletaPrMarca } from "@/types/database";

function marca(id: string): AtletaPrMarca {
  return {
    id,
    usuario_id: "u1",
    ejercicio: "back_squat",
    record_tipo: "pr",
    rm_reps: null,
    valor: 180,
    unidad: "lbs",
    fecha: "2026-07-02",
    notas: null,
    created_at: "2026-07-02T00:00:00Z",
  };
}

describe("skill achievement helpers", () => {
  it("detecta logrado y dominado", () => {
    expect(isSkillAchieved("logrado")).toBe(true);
    expect(isSkillAchieved("dominado")).toBe(true);
    expect(isSkillAchieved("en_proceso")).toBe(false);
  });

  it("genera badge key de skill", () => {
    expect(skillBadgeKey("pull_ups")).toBe("skill_pull_ups");
  });
});

describe("marca fixture", () => {
  it("usa libras", () => {
    expect(marca("1").unidad).toBe("lbs");
  });
});
