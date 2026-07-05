import { describe, expect, it } from "vitest";
import {
  enumeratePrImprovements,
  evaluateAggregatePrAchievements,
  evaluatePrAchievements,
  idempotencyKeyForPrMejora,
  idempotencyKeysForMarca,
  PR_ACHIEVEMENT_KEYS,
} from "./pr-achievements";
import type { AtletaPrMarca } from "@/types/database";

function marca(
  overrides: Partial<AtletaPrMarca> & Pick<AtletaPrMarca, "id" | "valor" | "fecha"> & {
    usuario_id?: string;
    ejercicio?: string;
  }
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

function collectMejoraKeysOnInsert(allMarcas: AtletaPrMarca[]): string[] {
  const keys: string[] = [];
  const sorted = [...allMarcas].sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (let i = 0; i < sorted.length; i++) {
    const slice = sorted.slice(0, i + 1);
    const marca = sorted[i];
    const awards = evaluatePrAchievements({ marca, allMarcas: slice });
    for (const a of awards) {
      if (a.badgeKey === PR_ACHIEVEMENT_KEYS.pr_mejora) {
        keys.push(a.idempotencyKey);
      }
    }
  }
  return keys;
}

describe("evaluatePrAchievements", () => {
  it("otorga primer_pr y primer_movimiento en el primer registro", () => {
    const first = marca({ id: "m1", valor: 100, fecha: "2026-07-01" });
    const awards = evaluatePrAchievements({ marca: first, allMarcas: [first] });
    const keys = awards.map((a) => a.badgeKey);

    expect(keys).toContain(PR_ACHIEVEMENT_KEYS.primer_pr);
    expect(keys).toContain(PR_ACHIEVEMENT_KEYS.primer_movimiento);
    expect(keys).not.toContain(PR_ACHIEVEMENT_KEYS.pr_mejora);
  });

  it("otorga pr_mejora cuando supera el valor anterior", () => {
    const old = marca({ id: "m1", valor: 100, fecha: "2026-07-01" });
    const improved = marca({ id: "m2", valor: 105, fecha: "2026-07-02" });
    const awards = evaluatePrAchievements({
      marca: improved,
      allMarcas: [old, improved],
    });

    expect(awards.some((a) => a.badgeKey === PR_ACHIEVEMENT_KEYS.pr_mejora)).toBe(
      true
    );
    expect(
      awards.find((a) => a.badgeKey === PR_ACHIEVEMENT_KEYS.pr_mejora)
        ?.metadata.previous_valor
    ).toBe(100);
  });

  it("no otorga logros si el peso es igual o menor", () => {
    const old = marca({ id: "m1", valor: 100, fecha: "2026-07-01" });
    const same = marca({ id: "m2", valor: 100, fecha: "2026-07-02" });
    const lower = marca({ id: "m3", valor: 95, fecha: "2026-07-03" });

    expect(
      evaluatePrAchievements({ marca: same, allMarcas: [old, same] })
    ).toEqual([]);
    expect(
      evaluatePrAchievements({ marca: lower, allMarcas: [old, lower] })
    ).toEqual([]);
  });

  it("secuencia 100→105→95→105 no duplica idempotency de mejora", () => {
    const m1 = marca({ id: "m1", valor: 100, fecha: "2026-07-01" });
    const m2 = marca({ id: "m2", valor: 105, fecha: "2026-07-02" });
    const m3 = marca({ id: "m3", valor: 95, fecha: "2026-07-03" });
    const m4 = marca({ id: "m4", valor: 105, fecha: "2026-07-04" });
    const all = [m1, m2, m3, m4];

    const mejoraKeys = collectMejoraKeysOnInsert(all);
    expect(mejoraKeys).toEqual([
      idempotencyKeyForPrMejora("u1", "back_squat:pr", 105),
    ]);
  });

  it("edición hacia arriba en mismo id genera nueva mejora con valor distinto", () => {
    const original = marca({ id: "m1", valor: 100, fecha: "2026-07-01" });
    const edited = marca({ id: "m1", valor: 110, fecha: "2026-07-01" });
    const awards = evaluatePrAchievements({
      marca: edited,
      allMarcas: [edited],
    });

    expect(awards.some((a) => a.badgeKey === PR_ACHIEVEMENT_KEYS.pr_mejora)).toBe(
      false
    );
    expect(awards.some((a) => a.badgeKey === PR_ACHIEVEMENT_KEYS.primer_pr)).toBe(
      true
    );

    const withHistory = marca({ id: "m0", valor: 100, fecha: "2026-06-01" });
    const awardsEdit = evaluatePrAchievements({
      marca: edited,
      allMarcas: [withHistory, edited],
    });
    expect(
      awardsEdit.find((a) => a.badgeKey === PR_ACHIEVEMENT_KEYS.pr_mejora)
        ?.idempotencyKey
    ).toBe(idempotencyKeyForPrMejora("u1", "back_squat:pr", 110));
  });

  it("edición hacia abajo no genera mejora", () => {
    const prev = marca({ id: "m0", valor: 100, fecha: "2026-06-01" });
    const editedDown = marca({ id: "m1", valor: 95, fecha: "2026-07-01" });
    expect(
      evaluatePrAchievements({ marca: editedDown, allMarcas: [prev, editedDown] })
    ).toEqual([]);
  });

  it("doble evaluación del mismo registro produce las mismas idempotency keys", () => {
    const old = marca({ id: "m1", valor: 100, fecha: "2026-07-01" });
    const improved = marca({ id: "m2", valor: 105, fecha: "2026-07-02" });
    const ctx = { marca: improved, allMarcas: [old, improved] };
    const first = evaluatePrAchievements(ctx).map((a) => a.idempotencyKey);
    const second = evaluatePrAchievements(ctx).map((a) => a.idempotencyKey);
    expect(first).toEqual(second);
  });

  it("otorga racha_mejoras_mes con 3 mejoras en el mismo mes", () => {
    const marcas = [
      marca({ id: "m1", valor: 100, fecha: "2026-07-01", ejercicio: "back_squat" }),
      marca({ id: "m2", valor: 105, fecha: "2026-07-02", ejercicio: "back_squat" }),
      marca({ id: "m3", valor: 100, fecha: "2026-07-03", ejercicio: "deadlift" }),
      marca({ id: "m4", valor: 110, fecha: "2026-07-04", ejercicio: "deadlift" }),
      marca({ id: "m5", valor: 80, fecha: "2026-07-05", ejercicio: "bench_press" }),
      marca({ id: "m6", valor: 85, fecha: "2026-07-06", ejercicio: "bench_press" }),
    ];
    const latest = marcas[5];
    const awards = evaluatePrAchievements({ marca: latest, allMarcas: marcas });
    expect(
      awards.some((a) => a.badgeKey === PR_ACHIEVEMENT_KEYS.racha_mejoras_mes)
    ).toBe(true);
  });

  it("otorga best_month cuando el mes supera récord personal", () => {
    const marcas = [
      marca({ id: "a1", valor: 100, fecha: "2026-06-01" }),
      marca({ id: "a2", valor: 105, fecha: "2026-06-02" }),
      marca({ id: "b1", valor: 100, fecha: "2026-07-01", ejercicio: "deadlift" }),
      marca({ id: "b2", valor: 110, fecha: "2026-07-02", ejercicio: "deadlift" }),
      marca({ id: "b3", valor: 80, fecha: "2026-07-03", ejercicio: "bench_press" }),
      marca({ id: "b4", valor: 85, fecha: "2026-07-04", ejercicio: "bench_press" }),
    ];
    const latest = marcas[5];
    const awards = evaluatePrAchievements({ marca: latest, allMarcas: marcas });
    expect(awards.some((a) => a.badgeKey === PR_ACHIEVEMENT_KEYS.best_month)).toBe(
      true
    );
  });

  it("aislamiento por atleta en idempotency keys", () => {
    const u1 = marca({ id: "m1", valor: 105, fecha: "2026-07-02", usuario_id: "u1" });
    const u2 = marca({ id: "m2", valor: 105, fecha: "2026-07-02", usuario_id: "u2" });
    const prev1 = marca({ id: "p1", valor: 100, fecha: "2026-07-01", usuario_id: "u1" });
    const prev2 = marca({ id: "p2", valor: 100, fecha: "2026-07-01", usuario_id: "u2" });

    const a1 = evaluatePrAchievements({ marca: u1, allMarcas: [prev1, u1] });
    const a2 = evaluatePrAchievements({ marca: u2, allMarcas: [prev2, u2] });
    const k1 = a1.find((a) => a.badgeKey === PR_ACHIEVEMENT_KEYS.pr_mejora)
      ?.idempotencyKey;
    const k2 = a2.find((a) => a.badgeKey === PR_ACHIEVEMENT_KEYS.pr_mejora)
      ?.idempotencyKey;

    expect(k1).toContain("u1");
    expect(k2).toContain("u2");
    expect(k1).not.toEqual(k2);
  });

  it("borrar marca expone keys revocables incluyendo mejora por valor", () => {
    const m = marca({ id: "del1", valor: 105, fecha: "2026-07-02" });
    const keys = idempotencyKeysForMarca(m);
    expect(keys).toContain(idempotencyKeyForPrMejora("u1", "back_squat:pr", 105));
    expect(keys).toContain("achievement:marca:del1:comeback");
  });

  it("recalcula agregados tras borrado simulado", () => {
    const marcas = [
      marca({ id: "m1", valor: 100, fecha: "2026-07-01" }),
      marca({ id: "m2", valor: 105, fecha: "2026-07-02" }),
      marca({ id: "m3", valor: 100, fecha: "2026-07-03", ejercicio: "deadlift" }),
      marca({ id: "m4", valor: 110, fecha: "2026-07-04", ejercicio: "deadlift" }),
      marca({ id: "m5", valor: 80, fecha: "2026-07-05", ejercicio: "bench_press" }),
      marca({ id: "m6", valor: 85, fecha: "2026-07-06", ejercicio: "bench_press" }),
    ];
    const remaining = marcas.slice(0, -1);
    const full = evaluateAggregatePrAchievements(marcas, "u1");
    const afterDelete = evaluateAggregatePrAchievements(remaining, "u1");

    expect(full.some((a) => a.badgeKey === PR_ACHIEVEMENT_KEYS.racha_mejoras_mes)).toBe(
      true
    );
    expect(
      afterDelete.some((a) => a.badgeKey === PR_ACHIEVEMENT_KEYS.racha_mejoras_mes)
    ).toBe(false);
    expect(enumeratePrImprovements(remaining)).toHaveLength(2);
  });
});
