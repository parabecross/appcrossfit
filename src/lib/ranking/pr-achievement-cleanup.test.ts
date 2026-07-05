import { describe, expect, it } from "vitest";
import {
  buildValidPrIdempotencyKeys,
  isPrAchievementEvent,
  idempotencyKeysForDeletedMarcaSnapshot,
} from "./pr-achievement-cleanup";
import {
  PR_ACHIEVEMENT_KEYS,
  idempotencyKeyForPrMejora,
} from "./pr-achievements";
import { marcaRecordKey, getRecordTipo } from "@/lib/progreso/helpers";
import type { AtletaPrMarca, RankingPointEvent } from "@/types/database";

function marca(
  overrides: Partial<AtletaPrMarca> & Pick<AtletaPrMarca, "id" | "valor" | "fecha">
): AtletaPrMarca {
  return {
    usuario_id: "u1",
    ejercicio: "back_squat",
    record_tipo: "pr",
    rm_reps: null,
    unidad: "lbs",
    notas: null,
    created_at: `${overrides.fecha}T12:00:00Z`,
    ...overrides,
  };
}

describe("isPrAchievementEvent", () => {
  it("detecta eventos PR/RM por badge_key e idempotency_key", () => {
    const events: Pick<RankingPointEvent, "idempotency_key" | "metadata">[] = [
      {
        idempotency_key: "achievement:u1:primer_pr",
        metadata: { badge_key: PR_ACHIEVEMENT_KEYS.primer_pr },
      },
      {
        idempotency_key: "achievement:mejora:u1:back_squat:pr:100",
        metadata: { badge_key: PR_ACHIEVEMENT_KEYS.pr_mejora },
      },
      {
        idempotency_key: "achievement:u1:skill_pullups",
        metadata: { badge_key: "skill_pullups" },
      },
    ];

    expect(isPrAchievementEvent(events[0], "u1")).toBe(true);
    expect(isPrAchievementEvent(events[1], "u1")).toBe(true);
    expect(isPrAchievementEvent(events[2], "u1")).toBe(false);
  });
});

describe("buildValidPrIdempotencyKeys", () => {
  it("Caso A: sin marcas, no hay keys válidas", () => {
    expect(buildValidPrIdempotencyKeys([]).size).toBe(0);
  });

  it("Caso B: primer PR genera keys de primer_pr y primer_movimiento", () => {
    const first = marca({ id: "m1", valor: 100, fecha: "2026-07-01" });
    const keys = buildValidPrIdempotencyKeys([first]);

    expect(keys.has("achievement:u1:primer_pr")).toBe(true);
    expect(
      keys.has("achievement:u1:primer_mov:back_squat:pr")
    ).toBe(true);
  });

  it("Caso C: mejora y agregados incluyen mejora y best_month", () => {
    const old = marca({ id: "m1", valor: 100, fecha: "2026-07-01" });
    const improved = marca({ id: "m2", valor: 105, fecha: "2026-07-02" });
    const keys = buildValidPrIdempotencyKeys([old, improved]);

    const recordKey = marcaRecordKey(
      improved.ejercicio,
      getRecordTipo(improved),
      improved.rm_reps
    );
    expect(
      keys.has(idempotencyKeyForPrMejora("u1", recordKey, 105))
    ).toBe(true);
    expect(
      [...keys].some((k) => k.startsWith("achievement:u1:best_month:"))
    ).toBe(true);
  });
});

describe("idempotencyKeysForDeletedMarcaSnapshot", () => {
  it("incluye keys de mejora y primer movimiento de la marca borrada", () => {
    const m = marca({ id: "m2", valor: 105, fecha: "2026-07-02" });
    const keys = idempotencyKeysForDeletedMarcaSnapshot(m);

    expect(keys).toContain("achievement:marca:m2:mejora");
    expect(keys).toContain("achievement:u1:primer_mov:back_squat:pr");
  });
});
