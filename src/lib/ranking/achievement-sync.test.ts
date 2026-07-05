import { describe, expect, it } from "vitest";
import {
  isSkillAchieved,
  resolveSkillRankingSync,
  skillBadgeKey,
  skillDominadoBadgeKey,
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
    expect(skillDominadoBadgeKey("pull_ups")).toBe("skill_pull_ups_dominado");
  });
});

describe("resolveSkillRankingSync", () => {
  it("otorga logrado al pasar de en_proceso a logrado", () => {
    expect(
      resolveSkillRankingSync("bar_muscle_up", "en_proceso", "logrado")
    ).toEqual([{ badgeKey: "skill_bar_muscle_up", action: "award" }]);
  });

  it("otorga bonus dominado al pasar de logrado a dominado", () => {
    expect(
      resolveSkillRankingSync("bar_muscle_up", "logrado", "dominado")
    ).toEqual([
      { badgeKey: "skill_bar_muscle_up_dominado", action: "award" },
    ]);
  });

  it("otorga logrado y dominado al marcar dominado directo", () => {
    expect(
      resolveSkillRankingSync("bar_muscle_up", null, "dominado")
    ).toEqual([
      { badgeKey: "skill_bar_muscle_up", action: "award" },
      { badgeKey: "skill_bar_muscle_up_dominado", action: "award" },
    ]);
  });

  it("revoca solo dominado al bajar de dominado a logrado", () => {
    expect(
      resolveSkillRankingSync("bar_muscle_up", "dominado", "logrado")
    ).toEqual([
      { badgeKey: "skill_bar_muscle_up_dominado", action: "revoke" },
    ]);
  });

  it("revoca ambos al quitar skill logrado", () => {
    expect(
      resolveSkillRankingSync("bar_muscle_up", "dominado", "none")
    ).toEqual([
      { badgeKey: "skill_bar_muscle_up", action: "revoke" },
      { badgeKey: "skill_bar_muscle_up_dominado", action: "revoke" },
    ]);
  });
});

describe("marca fixture", () => {
  it("usa libras", () => {
    expect(marca("1").unidad).toBe("lbs");
  });
});
