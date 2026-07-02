import { describe, expect, it } from "vitest";
import {
  badgeKeysToRevokeAfterPrDelete,
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

describe("badgeKeysToRevokeAfterPrDelete", () => {
  it("revoca primer_pr y benchmark si no quedan marcas", () => {
    expect(badgeKeysToRevokeAfterPrDelete([])).toEqual([
      "primer_pr",
      "benchmark",
    ]);
  });

  it("revoca solo benchmark si queda una marca", () => {
    expect(badgeKeysToRevokeAfterPrDelete([marca("1")])).toEqual(["benchmark"]);
  });

  it("no revoca nada si quedan dos o más marcas", () => {
    expect(badgeKeysToRevokeAfterPrDelete([marca("1"), marca("2")])).toEqual(
      []
    );
  });
});

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
